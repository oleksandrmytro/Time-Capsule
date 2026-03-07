package com.oleksandrmytro.timecapsule.config;

import com.mongodb.ConnectionString;
import com.mongodb.MongoClientSettings;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.data.mongodb.config.AbstractMongoClientConfiguration;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.security.cert.X509Certificate;

@Configuration
@Profile("mongo-ssl") // use only when TLS Mongo is required
public class MongoSslConfig extends AbstractMongoClientConfiguration {
    // Value - використовується для отримання URI MongoDB з application.properties або application.yml
    @Value("${spring.data.mongodb.uri}")
    private String mongoUri;

    @Value("${spring.data.mongodb.database:time-capsule}")
    private String database;

    @Override
    protected String getDatabaseName() {
        return database;
    }

    @Override
    // Bean для створення MongoClient з налаштуваннями SSL, які ігнорують сертифікати. Це потрібно для підключення до MongoDB з TLS, якщо сертифікат не є довіреним.
    @Bean
    public MongoClient mongoClient() {
        try {
            // Створюємо TrustManager, який довіряє всім сертифікатам
            TrustManager[] trustAllCerts = new TrustManager[]{
                new X509TrustManager() {
                    public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
                    public void checkClientTrusted(X509Certificate[] certs, String authType) {}
                    public void checkServerTrusted(X509Certificate[] certs, String authType) {}
                }
            };

            SSLContext sslContext = SSLContext.getInstance("SSL");
            sslContext.init(null, trustAllCerts, new java.security.SecureRandom());

            ConnectionString connectionString = new ConnectionString(mongoUri);
            // Налаштовуємо MongoClientSettings для використання SSL з нашим SSLContext
            MongoClientSettings settings = MongoClientSettings.builder()
                    .applyConnectionString(connectionString)    // застосовуємо URI з application.properties
                    .applyToSslSettings(builder -> builder
                            .enabled(true)          // вмикаємо SSL
                            .invalidHostNameAllowed(true)           // дозволяємо недійсні імена хостів (для тестування)
                            .context(sslContext))       // використовуємо наш SSLContext, який довіряє всім сертифікатам
                    .build();

            return MongoClients.create(settings);
        } catch (Exception e) {
            throw new RuntimeException("Failed to create MongoDB client with SSL configuration", e);
        }
    }
}
