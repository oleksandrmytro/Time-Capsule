package com.oleksandrmytro.timecapsule.services;

import com.oleksandrmytro.timecapsule.responses.LoginResponse;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.security.Key;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

/**
 * Service for JWT token operations.
 */
@Service
public class JwtService {

    @Value("${security.jwt.secret-key}")
    private String secretKey;

    @Value("${security.jwt.expiration-time}")
    private long jwtExpiration;

    @Value("${security.jwt.refresh-expiration-time:1209600000}") // 14d default
    private long refreshExpiration;

    @Value("${security.jwt.secret-version:1}")
    private String secretVersion;

    private static final Logger log = LoggerFactory.getLogger(JwtService.class);

    /**
     * Extract username from JWT token.
     */
    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    /**
     * Extract specific claim from JWT token.
     */
    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    /**
     * Generate JWT token for user including basic claims (id, email, role) when available.
     */
    public String generateToken(UserDetails userDetails) {
        Map<String, Object> extra = new HashMap<>();
        if (userDetails instanceof com.oleksandrmytro.timecapsule.models.User u) {
            extra.put("id", u.getId());
            extra.put("email", u.getEmail());
            extra.put("role", u.getRoleDb());
        }
        return generateToken(extra, userDetails);
    }

    /**
     * Generate JWT token with extra claims.
     */
    public String generateToken(Map<String, Object> extraClaims, UserDetails userDetails) {
        return buildToken(extraClaims, userDetails, jwtExpiration);
    }

    public String generateRefreshToken(UserDetails userDetails) {
        Map<String, Object> extra = new HashMap<>();
        if (userDetails instanceof com.oleksandrmytro.timecapsule.models.User u) {
            extra.put("id", u.getId());
            extra.put("email", u.getEmail());
            extra.put("role", u.getRoleDb());
            extra.put("token_type", "refresh");
            extra.put("kid", secretVersion);
        }
        return buildToken(extra, userDetails, refreshExpiration);
    }

    /**
     * Get JWT expiration time.
     */
    public long getExpirationTime() {
        return jwtExpiration;
    }

    public long getRefreshExpiration() {
        return refreshExpiration;
    }

    /**
     * Build JWT token.
     */
    private String buildToken(
            Map<String, Object> extraClaims,
            UserDetails userDetails,
            long expiration
    ) {
        return Jwts
                .builder()
                .setClaims(extraClaims)
                .setSubject(userDetails.getUsername())
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(getSignInKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    private String extractTokenType(String token) {
        return extractClaim(token, claims -> (String) claims.get("token_type"));
    }

    public String extractKid(String token) {
        return extractClaim(token, claims -> (String) claims.get("kid"));
    }

    public boolean isKidMismatched(String token) {
        String tokenKid = null;
        try {
            tokenKid = extractKid(token);
        } catch (Exception e) {
            log.warn("Failed to extract kid from token: {}", e.getMessage());
        }
        return tokenKid != null && !tokenKid.equals(secretVersion);
    }

    public LoginResponse regenerateIfSecretRotated(String refreshToken, com.oleksandrmytro.timecapsule.models.User user) {
        if (isKidMismatched(refreshToken)) {
            log.info("Refresh token secret rotated, issuing new tokens for userId={} email={}", user.getId(), user.getEmail());
            String access = generateToken(user);
            String refresh = generateRefreshToken(user);
            return new LoginResponse(access, getExpirationTime(), refresh, getRefreshExpiration());
        }
        return null;
    }

    /**
     * Validate JWT token.
     */
    public boolean isTokenValid(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        return (username.equals(userDetails.getUsername()) && !isTokenExpired(token));
    }

    public boolean isRefreshTokenValid(String token, UserDetails userDetails) {
        if (!"refresh".equalsIgnoreCase(extractTokenType(token))) {
            return false;
        }
        return isTokenValid(token, userDetails);
    }

    /**
     * Check if JWT token is expired.
     */
    private boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    /**
     * Extract expiration date from JWT token.
     */
    private Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    /**
     * Extract all claims from JWT token.
     */
    private Claims extractAllClaims(String token) {
        return Jwts
                .parserBuilder()
                .setSigningKey(getSignInKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    private Key getSignInKey() {
        byte[] keyBytes = Decoders.BASE64.decode(secretKey);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}
