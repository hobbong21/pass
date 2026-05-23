# MariaDB 전환 가이드

PASS 백엔드는 개발 시 SQLite, 운영 시 MariaDB로 동작하도록 설계되어 있습니다.
스키마 차이는 Prisma 두 파일로 분리되어 있습니다.

| 파일 | 용도 |
|---|---|
| `prisma/schema.prisma` | **현재 활성** — SQLite (dev.db) |
| `prisma/schema.mariadb.prisma` | MariaDB 운영용 (별도 보관) |
| `.env.example` | dev 환경 변수 |
| `.env.mariadb.example` | prod 환경 변수 템플릿 |

## 🚀 전환 절차

### 1. MariaDB 준비

**Docker로 빠르게:**
```bash
docker run -d --name pass-mariadb \
  -e MARIADB_ROOT_PASSWORD=root_pw \
  -e MARIADB_DATABASE=pass_prod \
  -e MARIADB_USER=pass_user \
  -e MARIADB_PASSWORD=strong_pw \
  -p 3306:3306 \
  mariadb:10.11

# 접속 확인
docker exec -it pass-mariadb mariadb -u pass_user -p pass_prod
```

**또는 호스트 설치 (Linux):**
```bash
sudo apt install mariadb-server
sudo mysql_secure_installation
sudo mysql -e "CREATE DATABASE pass_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER 'pass_user'@'localhost' IDENTIFIED BY 'strong_pw';"
sudo mysql -e "GRANT ALL ON pass_prod.* TO 'pass_user'@'localhost';"
```

### 2. 환경 변수 교체

```bash
cd backend
# dev .env 백업
mv .env .env.dev.bak

# 새 .env 생성 + 값 입력
cp .env.mariadb.example .env
# DATABASE_URL, JWT secrets, CORS_ORIGIN 등 채우기
```

### 3. Prisma 스키마 교체

```bash
# SQLite 스키마 보관
cp prisma/schema.prisma prisma/schema.sqlite.prisma

# MariaDB 스키마 활성화
cp prisma/schema.mariadb.prisma prisma/schema.prisma
```

### 4. 마이그레이션 재생성

> ⚠️ 기존 SQLite의 `migrations/` 폴더는 SQLite 전용. MariaDB로 전환할 때는 기존 마이그레이션을 삭제하거나 별도 보관하고 새로 생성합니다.

```bash
# 옵션 A — 깨끗하게 새로 시작 (개발 중일 때만)
rm -rf prisma/migrations
npx prisma migrate dev --name init_mariadb

# 옵션 B — 기존 마이그레이션 보관 + 새 마이그레이션 폴더
mv prisma/migrations prisma/migrations.sqlite
npx prisma migrate dev --name init_mariadb
```

### 5. 시드 데이터 (선택)

```bash
# seed.ts는 DB 종류와 무관하게 동작
npm run prisma:seed
```

### 6. 서버 부팅

```bash
npm run build
npm run start:prod
# 또는
npm run start:dev
```

## 🔄 스키마 차이 요약 (SQLite vs MariaDB)

| 항목 | SQLite | MariaDB |
|---|---|---|
| `datasource` provider | `sqlite` | `mysql` |
| 컬럼 길이 | 무제한 (Text) | `@db.VarChar(N)` 명시 |
| 긴 텍스트 | String | `@db.Text` |
| JSON 메타 | String (JSON.stringify) | `Json` 네이티브 타입 |
| `cuid` PK 컬럼 | TEXT | `@db.VarChar(40)` |

**코드 영향**: 서비스 레이어는 Prisma Client API로 동작하므로 **수정 불필요**. 단, `Relation.meta`를 MariaDB에서는 `Json` 타입으로 받을 수 있어 `JSON.parse` 호출이 불필요해집니다. 호환을 위해 현재 코드는 try/catch로 양쪽 모두 지원.

## 🐛 트러블슈팅

### "환경 변수 DATABASE_URL not found"
→ `.env` 파일이 있는지, Prisma CLI를 backend 폴더에서 실행하는지 확인.

### "Access denied for user"
→ MariaDB에 사용자/비밀번호/권한이 제대로 설정됐는지 확인. `GRANT ALL ON pass_prod.* TO 'pass_user'@'%';` (Docker는 `%`)

### "Migration failed: column too long"
→ MariaDB는 utf8mb4 기준 인덱스 키 길이 제한이 3072 bytes. 인덱스 컬럼들이 `VARCHAR(255)` 이내인지 확인. (이미 스키마에 적용됨)

### 한글 깨짐
→ DB 생성 시 `CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` 필수.

## 🐳 Docker Compose (참고용)

```yaml
# docker-compose.yml
version: '3.8'
services:
  mariadb:
    image: mariadb:10.11
    restart: unless-stopped
    environment:
      MARIADB_ROOT_PASSWORD: root_pw
      MARIADB_DATABASE: pass_prod
      MARIADB_USER: pass_user
      MARIADB_PASSWORD: strong_pw
    volumes:
      - mariadb_data:/var/lib/mysql
    ports:
      - "3306:3306"

  backend:
    build: .
    restart: unless-stopped
    environment:
      DATABASE_URL: mysql://pass_user:strong_pw@mariadb:3306/pass_prod
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      NODE_ENV: production
    ports:
      - "3000:3000"
    depends_on:
      - mariadb

volumes:
  mariadb_data:
```

## ↩️ SQLite로 되돌리기 (개발 모드)

```bash
cp prisma/schema.sqlite.prisma prisma/schema.prisma
mv .env .env.prod.bak
mv .env.dev.bak .env
# (필요 시 prisma/migrations.sqlite 복원)
npm run prisma:generate
```
