# Podrobny popis backendovych testu

Tato cast popisuje automatizovane testy backendove casti aplikace TimeCapsule. Testy jsou implementovane v adresari `backend/src/test/java` a pouzivaji JUnit 5, Mockito, Spring Boot Test a MockMvc.

Testovaci sada se spousti prikazem:

```bash
mvn -f backend/pom.xml test
```

Pri poslednim spusteni proslo celkem 27 testu:

```text
Tests run: 27, Failures: 0, Errors: 0, Skipped: 0
```

Testy jsou rozdeleny do nekolika skupin podle vrstvy aplikace: testy spusteni Spring Boot kontextu, testy REST controlleru, unit testy servisni logiky a testy infrastruktury, jako jsou cookies a auditni logovani.

## TimeCapsuleApplicationTests

Soubor: `backend/src/test/java/com/oleksandrmytro/timecapsule/TimeCapsuleApplicationTests.java`

Tento test overuje zakladni spustitelnost aplikace. Test pouziva anotaci `@SpringBootTest`, ktera se pokusi nacist Spring Boot aplikacni kontext.

### `contextLoads()`

Test neobsahuje zadne explicitni asserty. Jeho smyslem je overit, ze aplikace dokaze vytvorit Spring kontext bez chyby v konfiguraci, dependency injection nebo chybne definovanych bean tridach.

Zjednodusena podoba testu:

```java
@SpringBootTest
class TimeCapsuleApplicationTests {

    @Test
    void contextLoads() {
    }
}
```

Vyznam testu:

- kontroluje, ze hlavni Spring Boot konfigurace je validni,
- zachyti chyby v zakladnim zapojeni komponent,
- slouzi jako rychla kontrola, ze aplikace je alespon spustitelna.

## AuthenticationControllerTest

Soubor: `backend/src/test/java/com/oleksandrmytro/timecapsule/controllers/AuthenticationControllerTest.java`

Tento test kontroluje cast autentizacniho REST API. Pouziva `@WebMvcTest(AuthenticationController.class)`, tedy testuje pouze webovou vrstvu daneho controlleru. Zavislosti jako `AuthenticationService`, `JwtService`, `UserDetailsService`, `AdminAuditLogRepository` a `AuthCookieService` jsou nahrazeny mock objekty.

Diky tomu test nevyzaduje realnou databazi, realne JWT tokeny ani spusteny server.

### `refreshReturnsOk()`

Test overuje endpoint:

```text
POST /api/auth/refresh
```

Scenar:

1. Do pozadavku je vlozena cookie `refreshToken`.
2. Mockovany `AuthCookieService` vrati hodnotu refresh tokenu.
3. Mockovany `AuthenticationService` vrati novou dvojici access a refresh tokenu.
4. Controller vrati HTTP status `200 OK`.

Test zaroven kontroluje, ze `accessToken` a `refreshToken` nejsou soucasti JSON odpovedi. V aplikaci jsou tokeny schvalne oznacene pres `@JsonIgnore`, protoze maji byt ulozeny do `HttpOnly` cookies, ne citelne vraceny v tele odpovedi.

Zjednodusena podoba:

```java
given(authCookieService.requireRefreshTokenCookie(any())).willReturn("dummy");
given(authenticationService.refreshTokens(eq("dummy")))
    .willReturn(new LoginResponse("access", 1000, "refresh", 2000));

mockMvc.perform(post("/api/auth/refresh")
        .cookie(new Cookie("refreshToken", "dummy")))
    .andExpect(status().isOk())
    .andExpect(jsonPath("$.accessToken").doesNotExist())
    .andExpect(jsonPath("$.refreshToken").doesNotExist())
    .andExpect(jsonPath("$.expiresIn").value(1000))
    .andExpect(jsonPath("$.refreshExpiresIn").value(2000));
```

Vyznam testu:

- overuje refresh flow,
- kontroluje bezpecnostni rozhodnuti, ze tokeny nejsou vraceny v JSON,
- potvrzuje, ze controller spravne spolupracuje s cookie sluzbou.

### `refreshCheckReturns304WhenNoRotation()`

Test overuje endpoint:

```text
POST /api/auth/refresh/check
```

Scenar:

1. Pozadavek obsahuje refresh cookie.
2. `AuthenticationService.refreshWithRotationCheck()` vrati `null`.
3. To znamena, ze refresh token neni potreba rotovat.
4. Controller vrati HTTP status `304 Not Modified`.

Zjednodusena podoba:

```java
given(authCookieService.requireRefreshTokenCookie(any())).willReturn("dummy");
given(authenticationService.refreshWithRotationCheck(eq("dummy"))).willReturn(null);

mockMvc.perform(post("/api/auth/refresh/check")
        .cookie(new Cookie("refreshToken", "dummy")))
    .andExpect(status().isNotModified());
```

Vyznam testu:

- overuje optimalizovane refresh chovani,
- potvrzuje, ze API umi rozlisit situaci, kdy neni nutne vydavat nove tokeny,
- snizuje riziko regresi v session managementu.

## CapsuleControllerTest

Soubor: `backend/src/test/java/com/oleksandrmytro/timecapsule/controllers/CapsuleControllerTest.java`

Tento test kontroluje REST API pro praci s kapslemi. Pouziva `@WebMvcTest(CapsuleController.class)` a `MockMvc`. Servisni vrstva je nahrazena mockem `CapsuleService`, proto se test soustredi na chovani controlleru, validaci vstupu a mapovani vyjimek na HTTP odpovedi.

### `getEditableReturnsOkForAuthorizedEditor()`

Test overuje endpoint:

```text
GET /api/capsules/{id}/edit
```

Scenar:

1. Uzivatel je predan jako principal.
2. `CapsuleService.getEditable()` vrati objekt `CapsuleResponse`.
3. Controller vrati HTTP status `200 OK`.
4. Odpoved obsahuje ID a titulek kapsle.

Zjednodusena podoba:

```java
given(capsuleService.getEditable(CAPSULE_ID, "user")).willReturn(response);

mockMvc.perform(get("/api/capsules/{id}/edit", CAPSULE_ID)
        .principal(mockAuth()))
    .andExpect(status().isOk())
    .andExpect(jsonPath("$.id").value(CAPSULE_ID))
    .andExpect(jsonPath("$.title").value("Editable capsule"));
```

Vyznam testu:

- overuje ziskani kapsle pro editaci,
- kontroluje predani identity uzivatele do servisni vrstvy,
- potvrzuje strukturu JSON odpovedi.

### `getEditableReturnsForbiddenWhenServiceRejectsAuthorization()`

Test overuje chybovy scenar pro stejny endpoint:

```text
GET /api/capsules/{id}/edit
```

Scenar:

1. `CapsuleService.getEditable()` vyhodi `SecurityException`.
2. Globalni zpracovani vyjimek prevede chybu na HTTP status `403 Forbidden`.
3. JSON odpoved obsahuje kod chyby `forbidden`.

Zjednodusena podoba:

```java
given(capsuleService.getEditable(CAPSULE_ID, "user"))
    .willThrow(new SecurityException("Only owner or admin can edit this capsule"));

mockMvc.perform(get("/api/capsules/{id}/edit", CAPSULE_ID)
        .principal(mockAuth()))
    .andExpect(status().isForbidden())
    .andExpect(jsonPath("$.code").value("forbidden"));
```

Vyznam testu:

- overuje autorizacni chovani API,
- potvrzuje, ze bezpecnostni vyjimka nevede k internimu server erroru,
- kontroluje jednotny format chybove odpovedi.

### `updateReturnsOkWhenPayloadValid()`

Test overuje endpoint:

```text
PUT /api/capsules/{id}
```

Scenar:

1. Do pozadavku je poslan validni JSON payload pro upravu kapsle.
2. `CapsuleService.update()` vrati aktualizovanou kapsli.
3. Controller vrati `200 OK`.
4. JSON odpoved obsahuje aktualizovane hodnoty.

Zjednodusena podoba:

```java
given(capsuleService.update(eq(CAPSULE_ID), eq("user"), any(UpdateCapsuleRequest.class)))
    .willReturn(response);

mockMvc.perform(put("/api/capsules/{id}", CAPSULE_ID)
        .principal(mockAuth())
        .contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(validUpdatePayload())))
    .andExpect(status().isOk())
    .andExpect(jsonPath("$.id").value(CAPSULE_ID))
    .andExpect(jsonPath("$.title").value("Updated title"));
```

Vyznam testu:

- overuje uspesnou aktualizaci kapsle z pohledu REST API,
- kontroluje serializaci/deserializaci request DTO,
- potvrzuje, ze controller spravne vola servisni vrstvu.

### `createReturnsOkForDraftWithoutUnlockDate()`

Test overuje endpoint:

```text
POST /api/capsules
```

Scenar:

1. Uzivatel odesle validni data pro vytvoreni draft kapsle.
2. Payload neobsahuje datum odemceni.
3. `CapsuleService.create()` vrati kapsli se stavem `draft`.
4. Controller vrati `200 OK`.

Zjednodusena podoba:

```java
given(capsuleService.create(eq("user"), any(CreateCapsuleRequest.class)))
    .willReturn(response);

mockMvc.perform(post("/api/capsules")
        .principal(mockAuth())
        .contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(validCreatePayload())))
    .andExpect(status().isOk())
    .andExpect(jsonPath("$.status").value("draft"));
```

Vyznam testu:

- overuje vytvareni draft kapsle,
- potvrzuje, ze kapsle muze byt ulozena bez data odemceni,
- pokryva jeden z hlavnich use-cases aplikace.

### `updateReturnsForbiddenWhenServiceRejectsAuthorization()`

Test overuje chybovy scenar pri uprave kapsle.

Scenar:

1. Uzivatel odesle validni update request.
2. Servisni vrstva vyhodi `SecurityException`.
3. API vrati `403 Forbidden`.
4. Odpoved obsahuje kod `forbidden`.

Vyznam testu:

- overuje, ze neautorizovana editace je zamitnuta,
- potvrzuje spravne mapovani autorizacni chyby,
- chrani pravidlo, ze kapsli muze upravovat jen vlastnik nebo administrator podle business logiky.

### `updateReturnsBadRequestWhenValidationFails()`

Test overuje validaci vstupnich dat.

Scenar:

1. Do requestu je vlozen prazdny titulek.
2. Bean Validation zachyti chybu jeste pred zavolanim servisni vrstvy.
3. Controller vrati `400 Bad Request`.
4. Odpoved obsahuje kod `validation_error`.
5. Test overi, ze `CapsuleService.update()` nebyl zavolan.

Zjednodusena podoba:

```java
payload.setTitle(" ");

mockMvc.perform(put("/api/capsules/{id}", CAPSULE_ID)
        .principal(mockAuth())
        .contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(payload)))
    .andExpect(status().isBadRequest())
    .andExpect(jsonPath("$.code").value("validation_error"));

verify(capsuleService, never())
    .update(eq(CAPSULE_ID), eq("user"), any(UpdateCapsuleRequest.class));
```

Vyznam testu:

- overuje serverovou validaci,
- potvrzuje, ze nevalidni data nejsou predana do business logiky,
- snizuje riziko ulozeni nekonzistentnich dat.

## CapsuleServiceUpdateTest

Soubor: `backend/src/test/java/com/oleksandrmytro/timecapsule/services/CapsuleServiceUpdateTest.java`

Tento soubor obsahuje unit testy servisni logiky kapsli. Testuje tridu `CapsuleService` izolovane od realne databaze. Repozitare, `MongoTemplate`, notifikacni sluzba, e-mailova sluzba a dalsi zavislosti jsou nahrazeny mock objekty.

### `ownerCanUpdateOwnCapsule()`

Test overuje, ze vlastnik kapsle muze svoji kapsli upravit.

Scenar:

1. Existuje kapsle vlastnena testovanym uzivatelem.
2. Uzivatel ma roli `REGULAR`.
3. Update request obsahuje nove hodnoty.
4. Servis provede update pres `MongoTemplate.updateFirst()`.
5. Vracena odpoved obsahuje aktualizovane hodnoty.

Vyznam testu:

- overuje zakladni pravidlo vlastnictvi,
- potvrzuje, ze vlastnik ma pravo upravovat vlastni kapsli,
- kontroluje, ze update vede k databazove operaci.

### `createDefaultsToDraftWithoutUnlockDate()`

Test overuje vytvoreni kapsle bez data odemceni.

Scenar:

1. Request obsahuje titulek, telo, viditelnost a tagy.
2. Request neobsahuje `unlockAt`.
3. Servis nastavi stav kapsle na `draft`.
4. `unlockAt`, `expiresAt` a `shareToken` zustanou prazdne.

Vyznam testu:

- overuje pravidlo, ze kapsle bez casoveho planu je draft,
- chrani logiku rozliseni draft a sealed stavu,
- potvrzuje, ze draft kapsle nema share token.

### `ownerCanUpdateDraftWithoutUnlockDate()`

Test overuje, ze vlastnik muze zmenit kapsli na draft bez data odemceni.

Scenar:

1. Existuje kapsle ve stavu `sealed`.
2. Vlastnik posle update request se stavem `draft`.
3. Request nema `unlockAt` ani `expiresAt`.
4. Servis provede update.
5. Vracena odpoved ma stav `draft`.

Vyznam testu:

- overuje prechod kapsle z planovaneho stavu zpet do draftu,
- kontroluje, ze draft nemusi mit datum odemceni,
- potvrzuje, ze pri draftu neni vygenerovan share token.

### `adminCanUpdateForeignOpenedCapsule()`

Test overuje administratorske opravneni.

Scenar:

1. Existuje cizi kapsle ve stavu `opened`.
2. Aktualni uzivatel ma roli `ADMIN`.
3. Admin provede update.
4. Servis update povoli.

Vyznam testu:

- overuje rozdil mezi beznym uzivatelem a administratorem,
- potvrzuje, ze administrator muze spravovat i cizi otevrene kapsle,
- pokryva dulezite pravidlo administracni casti systemu.

### `nonOwnerNonAdminCannotUpdateCapsule()`

Test overuje zakaz upravy cizi kapsle bez administratorske role.

Scenar:

1. Existuje kapsle vlastnena jinym uzivatelem.
2. Aktualni uzivatel je bezny uzivatel.
3. Pri pokusu o update servis vyhodi `SecurityException`.
4. Test overi, ze neprobehla zadna databazova update operace.

Zjednodusena podoba:

```java
assertThrows(SecurityException.class,
    () -> capsuleService.update(CAPSULE_ID, OTHER_USER_ID, validRequest()));

verify(mongoTemplate, never())
    .updateFirst(any(Query.class), any(Update.class), eq(Capsule.class));
```

Vyznam testu:

- chrani pristupova prava,
- zabraňuje regresi, kdy by uzivatel mohl upravit cizi data,
- potvrzuje, ze pri chybe se neprovede zapis do databaze.

### `ownerCannotUpdateOpenedCapsule()`

Test overuje pravidlo, ze otevrena kapsle uz neni bezne editovatelna vlastnikem.

Scenar:

1. Kapsle patri aktualnimu uzivateli.
2. Kapsle je ve stavu `opened`.
3. Uzivatel se ji pokusi upravit.
4. Servis vyhodi `SecurityException`.
5. Update do databaze se neprovede.

Vyznam testu:

- chrani doménove pravidlo nemennosti otevrene kapsle,
- overuje rozdil mezi draft/sealed a opened stavem,
- zabranuje zpetnym upravam obsahu po otevreni kapsle.

### `updateRejectsInvalidExpiryOrder()`

Test overuje validaci casovych hodnot.

Scenar:

1. Request obsahuje `unlockAt`.
2. `expiresAt` je nastaven drive nez `unlockAt`.
3. Servis vyhodi `IllegalArgumentException`.
4. Databazovy update se neprovede.

Vyznam testu:

- overuje logickou validitu casoveho planu,
- chrani pred nekonzistentnimi daty,
- potvrzuje, ze neplatny request nekonci zapisem do databaze.

### `sharedDraftCannotBeViewedByGrantee()`

Test overuje pristup ke sdilene draft kapsli.

Scenar:

1. Kapsle ma viditelnost `shared`.
2. Kapsle je ve stavu `draft`.
3. Jiny uzivatel ma share vazbu ke kapsli.
4. I presto servis nedovoli zobrazeni kapsle.

Vyznam testu:

- potvrzuje, ze draft kapsle neni verejne dostupna ani pres share,
- chrani nedokonceny obsah pred predcasnym zobrazenim,
- overuje pravidla sdileni podle stavu kapsle.

## UserServiceSuggestUsersTest

Soubor: `backend/src/test/java/com/oleksandrmytro/timecapsule/services/UserServiceSuggestUsersTest.java`

Tento soubor testuje doporucovani uzivatelu. Testy pouzivaji mockovane repozitare a `MongoTemplate`, aby bylo mozne presne simulovat socialni graf.

### `suggestUsersRanksNetworkCandidatesAndSkipsAdmins()`

Test overuje doporucovani uzivatelu podle vztahu follower/following.

Scenar:

1. Test vytvori nekolik uzivatelu: sledovaneho uzivatele, sledujiciho, mutual kandidata, dalsi kandidaty a administratora.
2. Mockovane `FollowRepository` vraci vazby socialniho grafu.
3. `UserService.suggestUsers()` vyhodnoti vhodne kandidaty.
4. Test overi poradi doporucenych uzivatelu.
5. Administrator je z vysledku vynechan.

Zjednodusena podoba:

```java
List<User> suggestions = userService.suggestUsers(ME_ID, 12);

assertEquals(
    List.of(MUTUAL_ID, SECONDARY_ID, TERTIARY_ID),
    suggestions.stream().map(User::getId).toList()
);
```

Vyznam testu:

- overuje logiku doporucovani uzivatelu,
- kontroluje razeni kandidatu,
- potvrzuje, ze administratori nejsou doporucovani beznym uzivatelum.

### `suggestUsersFallsBackToPublicSearchWhenGraphIsEmpty()`

Test overuje fallback scenar.

Scenar:

1. Uzivatel nema zadne follower/following vazby.
2. Socialni graf nevrati zadne kandidaty.
3. Servis pouzije fallback pres `MongoTemplate.find()`.
4. Vysledek obsahuje uzivatele z verejneho vyhledani.

Vyznam testu:

- overuje, ze funkce doporucovani funguje i pro nove nebo izolovane uzivatele,
- potvrzuje fallback mechanismus,
- zlepsuje spolehlivost uzivatelskeho workflow.

## AuthCookieServiceTest

Soubor: `backend/src/test/java/com/oleksandrmytro/timecapsule/config/AuthCookieServiceTest.java`

Tento test overuje pomocnou sluzbu pro praci s autentizacnimi cookies. Testy pouzivaji `MockHttpServletRequest` a `MockHttpServletResponse`, tedy neni potreba realny webovy server.

### `writeAuthCookiesUsesSecureNoneForCrossSiteHttpsRequests()`

Test overuje zapis autentizacnich cookies pro cross-site HTTPS pozadavek.

Scenar:

1. Request simuluje HTTPS pres header `X-Forwarded-Proto: https`.
2. Request obsahuje `Origin` s jinou domenou nez API.
3. `AuthCookieService.writeAuthCookies()` zapise access a refresh cookie.
4. Test kontroluje atributy cookies.

Overovane atributy:

- `HttpOnly`,
- `SameSite=None`,
- `Secure`,
- spravny `Path`,
- spravny `Max-Age`.

Zjednodusena podoba:

```java
authCookieService.writeAuthCookies(request, response, tokens);

List<String> cookies = response.getHeaders("Set-Cookie");

assertTrue(cookies.get(0).contains("SameSite=None"));
assertTrue(cookies.get(0).contains("Secure"));
assertTrue(cookies.get(1).contains("Path=/api/auth"));
```

Vyznam testu:

- overuje bezpecne ukladani tokenu do cookies,
- kontroluje podporu frontend/backend komunikace pres ruzne domeny,
- chrani autentizacni mechanismus pred regresi.

### `clearAuthCookiesExpiresCurrentAndLegacyCookiePaths()`

Test overuje mazani autentizacnich cookies.

Scenar:

1. Zavola se `clearAuthCookies()`.
2. Sluzba zapise expiracni `Set-Cookie` hlavicky.
3. Test overuje, ze jsou mazany soucasne i starsi cesty cookies.

Mazane cookies:

- `accessToken`,
- `refreshToken` na `/api/auth`,
- legacy `refreshToken` na `/`,
- `JSESSIONID`,
- `SESSION`.

Vyznam testu:

- overuje korektni logout cleanup,
- pomaha zabranit zustatkum starych session cookies,
- resi kompatibilitu se starsim chovanim aplikace.

### `requireRefreshTokenCookieRejectsMissingCookie()`

Test overuje chybovy scenar pri chybejici refresh cookie.

Scenar:

1. Request neobsahuje zadne cookies.
2. Zavola se `requireRefreshTokenCookie()`.
3. Sluzba vyhodi `IllegalArgumentException`.

Vyznam testu:

- overuje, ze refresh endpoint nemuze pokracovat bez refresh tokenu,
- potvrzuje explicitni chybove chovani,
- chrani autentizacni flow pred nevalidnim vstupem.

## ApiAuditInterceptorTest

Soubor: `backend/src/test/java/com/oleksandrmytro/timecapsule/config/ApiAuditInterceptorTest.java`

Tento test overuje interceptor, ktery zapisuje auditni zaznamy pro mutacni API operace. Test nastavuje `SecurityContextHolder`, aby simuloval prihlaseneho uzivatele.

### `afterCompletionPersistsSuccessfulApiMutationForAuthenticatedUser()`

Test overuje, ze uspesny mutacni API pozadavek vytvori auditni zaznam.

Scenar:

1. Do security contextu je vlozen prihlaseny administrator.
2. Test vytvori mock request:

```text
PUT /api/capsules/507f1f77bcf86cd799439011?draft=false
```

3. Response ma status `200`.
4. Interceptor po dokonceni requestu vytvori `AdminAuditLog`.
5. Test pomoci `ArgumentCaptor` overi obsah ulozeneho zaznamu.

Overovane hodnoty:

- `actorId`,
- `actorEmail`,
- `action`,
- `entityType`,
- `entityId`,
- HTTP metoda,
- path,
- query string,
- status.

Zjednodusena podoba:

```java
interceptor.afterCompletion(request, response, new Object(), null);

ArgumentCaptor<AdminAuditLog> captor = ArgumentCaptor.forClass(AdminAuditLog.class);
verify(adminAuditLogRepository).save(captor.capture());

assertEquals("API_PUT_CAPSULES", captor.getValue().getAction());
assertEquals("capsules", captor.getValue().getEntityType());
```

Vyznam testu:

- overuje auditovatelnost dulezitych API operaci,
- potvrzuje, ze se uklada informace o uzivateli a cilove entite,
- podporuje administracni a bezpecnostni pozadavky aplikace.

### `afterCompletionSkipsReadRequestsAndFailedResponses()`

Test overuje, ze interceptor neloguje nevhodne requesty.

Scenar:

1. `GET /api/capsules` se neloguje, protoze nejde o mutacni operaci.
2. `POST /api/capsules` se statusem `403` se neloguje, protoze pozadavek nebyl uspesny.
3. Test overi, ze `adminAuditLogRepository.save()` nebyl zavolan.

Vyznam testu:

- zabranuje zbytecnemu logovani read-only pozadavku,
- zabranuje logovani neuspesnych mutaci jako provedenych akci,
- udrzuje audit log presnejsi a prehlednejsi.

## ChatServiceTest

Soubor: `backend/src/test/java/com/oleksandrmytro/timecapsule/services/ChatServiceTest.java`

Tento soubor testuje servisni logiku chatu. Zavisle komponenty jako `UserService`, `SimpMessagingTemplate`, `ChatMessageRepository` a `EmailService` jsou mockovane.

### `sendMessageTrimsTextPersistsItAndDeliversToPeer()`

Test overuje odeslani textove zpravy.

Scenar:

1. Uzivatel posle text `"  hello  "`.
2. Servis text otrimuje na `"hello"`.
3. Vytvori se `ChatMessage`.
4. Zprava se ulozi pres `ChatMessageRepository`.
5. Zprava se odesle prijemci pres WebSocket.
6. Vytvori se e-mailovy digest pro prijemce.

Zjednodusena podoba:

```java
Map<String, Object> payload = chatService.sendMessage(
    SENDER_ID, PEER_ID, "  hello  ", null, null, null, null
);

verify(chatMessageRepository).save(messageCaptor.capture());
assertEquals("hello", messageCaptor.getValue().getText());
verify(messagingTemplate).convertAndSendToUser(eq(PEER_ID), eq("/queue/chat"), any(Map.class));
verify(emailService).enqueueChatDigest(PEER_ID, "sender", "hello");
```

Vyznam testu:

- overuje hlavni chatovy use-case,
- kontroluje normalizaci textu,
- potvrzuje ulozeni, WebSocket doruceni a e-mailovou notifikaci.

### `sendMessageAcceptsMediaOnlyMessageAndBuildsDigestPreview()`

Test overuje odeslani zpravy bez textu, ale s mediem.

Scenar:

1. Text obsahuje pouze mezeru.
2. Request obsahuje `mediaUrl`, `mediaKind=image` a `mimeType=image/jpeg`.
3. Servis zpravu prijme, protoze obsahuje medium.
4. Typ zpravy je nastaven na `image`.
5. Text v payloadu je prazdny retezec.
6. E-mailovy digest obsahuje text `Sent you an image`.

Vyznam testu:

- overuje podporu obrazkovych zprav,
- potvrzuje, ze text neni povinny, pokud existuje media obsah,
- kontroluje spravny preview text pro notifikaci.

### `sendMessageRejectsEmptyMessageBeforePersistence()`

Test overuje odmítnuti uplne prazdne zpravy.

Scenar:

1. Text je prazdny nebo obsahuje pouze mezery.
2. Neexistuje zadny media soubor.
3. Servis vyhodi `IllegalArgumentException`.
4. Test overi, ze se nevola repository, WebSocket ani e-mailovy servis.

Zjednodusena podoba:

```java
assertThrows(IllegalArgumentException.class, () ->
    chatService.sendMessage(SENDER_ID, PEER_ID, " ", null, null, null, null)
);

verify(chatMessageRepository, never()).save(any(ChatMessage.class));
verify(messagingTemplate, never()).convertAndSendToUser(any(), any(), any());
verify(emailService, never()).enqueueChatDigest(any(), any(), any());
```

Vyznam testu:

- zabranuje ukladani prazdnych zprav,
- chrani chat pred nekonzistentnim obsahem,
- potvrzuje, ze pri chybe nevznikaji vedlejsi efekty.

## Celkove zhodnoceni

Soucasna testovaci sada pokryva hlavni backendove oblasti aplikace:

- spustitelnost Spring Boot aplikace,
- autentizaci a refresh tokeny,
- praci s `HttpOnly` cookies,
- vytvareni a upravy kapsli,
- validaci vstupnich dat,
- autorizacni pravidla,
- doporucovani uzivatelu,
- chatove zpravy a WebSocket doruceni,
- auditni logovani mutacnich API operaci.

Testy jsou prevazne unit a controller testy. To znamena, ze jsou rychle, nevyzaduji realnou databazi a jsou vhodne pro automaticke spousteni v CI pipeline. Pro dalsi rozsireni by bylo mozne doplnit integracni testy s testovaci MongoDB databazi a frontendove end-to-end testy hlavních uzivatelskych scenaru.
