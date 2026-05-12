# Testovani backendove casti

Backend aplikace je testovan pomoci JUnit 5, Mockito a nastroju ze Spring Boot Test. Testy jsou ulozeny v adresari `backend/src/test/java` a lze je spustit prikazem:

```bash
mvn -f backend/pom.xml test
```

Pri poslednim spusteni testovaci sady proslo 27 testu bez chyb:

```text
Tests run: 27, Failures: 0, Errors: 0, Skipped: 0
```

## Typy testu

Testovani je rozdeleno na nekolik urovni:

- unit testy servisni logiky,
- testy konfiguracnich a infrastrukturnich trid,
- testy REST controlleru pomoci `MockMvc`,
- zakladni test nacteni aplikacniho kontextu.

Tento pristup umoznuje overit jak samostatnou business logiku bez databaze, tak chovani HTTP vrstvy aplikace.

## Testy controlleru

REST controllery jsou testovany pomoci `@WebMvcTest` a `MockMvc`. Testy nevyzaduji spusteny server ani realnou databazi, protoze zavislosti controlleru jsou nahrazeny mock objekty.

Pokryte oblasti:

- `AuthenticationControllerTest` overuje obnoveni access tokenu pres refresh cookie a situaci, kdy refresh token neni nutne rotovat.
- `CapsuleControllerTest` overuje ziskani editovatelne kapsle, vytvoreni draft kapsle, aktualizaci kapsle, validacni chyby a zamitnuti neautorizovane editace.

Diky temto testum je overeno, ze API vraci spravne HTTP statusy a spravnou strukturu odpovedi i pri chybovych stavech.

## Testy servisni logiky

Servisni vrstva je testovana jako izolovana business logika s pouzitim Mockito. Databazove repozitare, `MongoTemplate`, e-mailovy servis a WebSocket sablona jsou nahrazeny mock objekty.

Pokryte oblasti:

- `CapsuleServiceUpdateTest` testuje pravidla pro vytvareni a upravu kapsli. Overuje napr. draft bez data odemceni, upravu vlastnikem, upravu administratorem, zakaz upravy otevrene kapsle a validaci poradi `unlockAt` a `expiresAt`.
- `UserServiceSuggestUsersTest` testuje doporucovani uzivatelu podle socialniho grafu a fallback na verejne vyhledani, pokud graf neobsahuje vhodne kandidaty.
- `ChatServiceTest` testuje odeslani textove zpravy, odeslani zpravy pouze s mediem, doruceni zpravy pres WebSocket, vytvoreni nahledu pro e-mailovy digest a odmitnuti prazdne zpravy.

Tyto testy pomahaji overit hlavni pravidla aplikace bez zavislosti na realne MongoDB instanci.

## Testy konfigurace a infrastruktury

Krome business logiky jsou testovany take pomocne infrastrukturni casti aplikace:

- `AuthCookieServiceTest` overuje zapis `HttpOnly` cookies, nastaveni `SameSite=None` a `Secure` pro cross-site HTTPS pozadavky, mazani soucasnych i legacy cookies a chybu pri chybejicim refresh tokenu.
- `ApiAuditInterceptorTest` overuje, ze uspesne mutacni API pozadavky vytvari auditni zaznam, zatimco cteci pozadavky a chybove odpovedi se neloguji.

Tyto testy jsou dulezite hlavne proto, ze se tykaji bezpecnosti, autentizace a auditovatelnosti operaci v systemu.

## Shrnuti pokryti

Aktualni testovaci sada pokryva nejdulezitejsi backendove scenare:

- autentizaci a refresh tokeny pres cookies,
- validaci a autorizaci pri praci s kapslemi,
- vytvareni a aktualizaci kapsli,
- pravidla pro draft, sealed a opened stav,
- doporucovani uzivatelu,
- chatove zpravy a WebSocket doruceni,
- auditni logovani API operaci,
- zakladni spustitelnost Spring Boot aplikace.

Testy nejsou plnohodnotnou end-to-end sadou cele aplikace, ale pokryvaji kriticke backendove use-cases a regresni scenare. Pro dalsi rozsireni by davalo smysl doplnit integracni testy s testovaci MongoDB databazi a frontendove testy pro hlavni uzivatelske workflow.

## Automaticke spousteni testu v GitHub Actions

Pro kontrolu testu pri praci s repozitarem je pridan workflow `.github/workflows/backend-tests.yml`.
Workflow se spousti automaticky pri:

- `push` do vetvi `main` nebo `master`,
- vytvoreni nebo aktualizaci `pull_request` do vetvi `main` nebo `master`.

GitHub Actions pripravi prostredi s Java 21 a spusti backendove testy prikazem:

```bash
mvn -B -f backend/pom.xml test
```

Pokud nektery test selze, GitHub oznaci workflow jako neuspesny. Diky tomu je mozne pred sloucenim zmen videt, zda nova uprava nerozbila existujici backendovou funkcionalitu.
