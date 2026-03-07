package com.oleksandrmytro.timecapsule.config;

import com.oleksandrmytro.timecapsule.events.CapsuleStatusEvent;
import com.oleksandrmytro.timecapsule.models.Capsule;
import com.oleksandrmytro.timecapsule.models.enums.CapsuleStatus;
import com.oleksandrmytro.timecapsule.repositories.UserRepository;
import com.oleksandrmytro.timecapsule.services.CapsuleNotificationService;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

/**
 * CapsuleUnlockScheduler — бекендовий шедулер для автоматичного відкриття капсул.
 * Причина створення окремого класу: у MongoDB немає тригерів для зміни статусу документів за часом(таке є тільки у MongoDB Atlas),
 * TTL-індекси лише видаляють документи, а не змінюють їх. Тому шедулер — єдиний варіант для автоматичного відкриття.
 * Кожні 5 секунд перевіряє sealed-капсули, у яких настав час unlockAt,
 * відкриває їх у базі та надсилає WS-подію власнику.
 */

/** @Component — це анотація Spring, яка позначає клас як компонент, що може бути автоматично виявлений та керований Spring-контейнером.
 * Це дозволяє Spring створювати екземпляри цього класу та інжектити його залежності, а також виконувати методи, позначені @Scheduled,
 * у відповідності до заданого розкладу.
 * У цьому випадку CapsuleUnlockScheduler буде автоматично запущений при старті додатку,
 * і метод unlockReadyCapsules буде виконуватися кожні 5 секунд для перевірки та відкриття капсул.
 */

@Component
public class CapsuleUnlockScheduler {

    private final MongoTemplate mongoTemplate;
    private final CapsuleNotificationService notificationService;
    private final UserRepository userRepository;

    /**
     * Конструктор: інжектить залежності для роботи з базою, WS та репозиторієм користувачів.
     */
    public CapsuleUnlockScheduler(MongoTemplate mongoTemplate, CapsuleNotificationService notificationService, UserRepository userRepository) {
        this.mongoTemplate = mongoTemplate;
        this.notificationService = notificationService;
        this.userRepository = userRepository;
    }

    /**
     * unlockReadyCapsules — основний метод шедулера.
     * 1. Шукає sealed-капсули, які готові до відкриття.
     * 2. Оновлює їх статус на opened.
     * 3. Надсилає WS-подію власнику про відкриття.
     */
    @Scheduled(fixedDelay = 5000) // кожні 5 секунд
    public void unlockReadyCapsules() {
        // Отримання поточного часу
        Instant now = Instant.now();

        // 1. Формуємо запит для sealed-капсул, які готові до відкриття
        Query query = new Query(
                Criteria.where("status").is(CapsuleStatus.SEALED.getValue())
                        .and("deletedAt").is(null)
                        .and("unlockAt").lte(now)
        );
        List<Capsule> ready = mongoTemplate.find(query, Capsule.class);

        if (ready.isEmpty()) return; // 2. Якщо немає — вихід

        // 3. Оновлюємо статус капсул
        Update update = new Update()
                .set("status", CapsuleStatus.OPENED.getValue())
                .set("openedAt", now)
                .set("updatedAt", now);
        mongoTemplate.updateMulti(query, update, Capsule.class);

        // 4. Для кожної капсули надсилаємо WS-подію власнику
        for (Capsule c : ready) {
            // Отримуємо ownerId капсули у вигляді рядка (hex), якщо він існує
            String ownerId = c.getOwnerId() != null ? c.getOwnerId().toHexString() : null;
            // Якщо ownerId не визначено — пропускаємо цю капсулу
            if (ownerId == null) continue;
            // Створюємо подію CapsuleStatusEvent для повідомлення про відкриття капсули
            CapsuleStatusEvent event = new CapsuleStatusEvent(
                    c.getId(),          // id капсули
                    CapsuleStatus.OPENED.getValue(),           // новий статус
                    false,              // isLocked — капсула вже відкрита, тому
                    c.getUnlockAt(),    // unlockAt — залишаємо без змін
                    now,                // openedAt — встановлюємо на поточний час
                    c.getTags()         // tags — залишаємо без змін
            );

            // Знаходимо власника капсули в базі за ownerId
            userRepository.findById(ownerId).ifPresent(user ->
                    // Якщо користувач знайдений — надсилаємо йому WS-подію через notificationService
                    notificationService.sendStatus(user.getEmail(), event)
            );
        }
    }
}
