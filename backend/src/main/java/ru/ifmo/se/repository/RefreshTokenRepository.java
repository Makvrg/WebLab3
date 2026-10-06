package ru.ifmo.se.repository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jooq.DSLContext;
import ru.ifmo.se.app_db.jooq.tables.records.RefreshTokenRecord;
import ru.ifmo.se.entity.RefreshToken;

import java.time.OffsetDateTime;
import java.util.Optional;

import static ru.ifmo.se.app_db.jooq.tables.RefreshToken.REFRESH_TOKEN;

@ApplicationScoped
public class RefreshTokenRepository {

    private final DSLContext dslContext;

    @Inject
    public RefreshTokenRepository(DSLContext dslContext) {
        this.dslContext = dslContext;
    }

    private RefreshToken parseDomainToken(RefreshTokenRecord record) {
        return new RefreshToken(
                record.getRefreshTokenId(), record.getUserId(),
                record.getHashedToken(), record.getSalt(),
                record.getExpiresAt(), record.getCreatedAt()
        );
    }

    public Optional<RefreshToken> getTokenByTokenId(Integer tokenId) {
        return dslContext.selectFrom(REFRESH_TOKEN)
                .where(REFRESH_TOKEN.IS_DELETED.isFalse(),
                       REFRESH_TOKEN.REFRESH_TOKEN_ID.eq(tokenId))
                .fetchOptional()
                .map(this::parseDomainToken);
    }

    public void addToken(RefreshToken token) {
        dslContext.insertInto(REFRESH_TOKEN)
                .set(REFRESH_TOKEN.USER_ID, token.getUserId())
                .set(REFRESH_TOKEN.HASHED_TOKEN, token.getHashedToken())
                .set(REFRESH_TOKEN.SALT, token.getSalt())
                .set(REFRESH_TOKEN.EXPIRES_AT, token.getExpiresAt())
                .set(REFRESH_TOKEN.CREATED_AT, token.getCreatedAt())
                .set(REFRESH_TOKEN.IS_DELETED, false)
                .execute();
    }

    public boolean deleteTokenByTokenId(Integer tokenId) {
        int affectedRows = dslContext.update(REFRESH_TOKEN)
                .set(REFRESH_TOKEN.IS_DELETED, true)
                .where(REFRESH_TOKEN.REFRESH_TOKEN_ID.eq(tokenId),
                       REFRESH_TOKEN.IS_DELETED.isFalse())
                .execute();
        return affectedRows > 0;
    }

    public int deleteTokensByExpired() {
        return dslContext.update(REFRESH_TOKEN)
                .set(REFRESH_TOKEN.IS_DELETED, true)
                .where(REFRESH_TOKEN.IS_DELETED.isFalse(),
                       REFRESH_TOKEN.EXPIRES_AT.lt(OffsetDateTime.now()))
                .execute();
    }
}
