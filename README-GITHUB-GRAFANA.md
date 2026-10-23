# PetCare Spa - GitHub + Prometheus + Grafana (Windows / Docker Desktop)

## 1. Dua du an len GitHub an toan

1. Tao repository tren GitHub theo dung quy tac ma so sinh vien giao vien yeu cau.
2. Trong thu muc goc `petcare-spa`, them cac dong trong `GITIGNORE-ADD.txt` vao `.gitignore`. Neu chua co `.gitignore`, co the doi ten `GITIGNORE-ADD.txt` thanh `.gitignore` va bo dong ghi chu dau tien.
3. Kiem tra chac chan `.env`, `backend/.env` va `node_modules` khong duoc dua len GitHub. Khong commit mat khau PostgreSQL/JWT.
4. Mo PowerShell tai thu muc goc:

```powershell
git status
git init
git add .
git status
git commit -m "chore: initialize PetCare Spa project"
git branch -M main
git remote add origin https://github.com/<GITHUB_USERNAME>/<REPOSITORY_NAME>.git
git push -u origin main
```

Neu `git status` bao da la repository thi khong can `git init`. Neu remote `origin` da ton tai, kiem tra bang `git remote -v` va khong them lai.

## 2. Cai cau hinh monitoring

Giai nen thu muc `monitoring` trong goi nay vao thu muc goc `petcare-spa`. Ket qua can co:

```text
petcare-spa/
  backend/
  frontend/
  monitoring/
    compose.yaml
    .env.example
    prometheus/prometheus.yml
    grafana/provisioning/datasources/prometheus.yml
    grafana/provisioning/dashboards/dashboards.yml
    grafana/dashboards/petcare-overview.json
```

Mo PowerShell tai thu muc goc `petcare-spa`, chay:

```powershell
Copy-Item .\monitoring\.env.example .\monitoring\.env
notepad .\monitoring\.env
```

Trong `monitoring/.env`, doi `GF_SECURITY_ADMIN_PASSWORD` va `POSTGRES_EXPORTER_PASSWORD` thanh mat khau manh rieng. Tuyet doi khong commit file `monitoring/.env`.

`POSTGRES_EXPORTER_USER` can la tai khoan PostgreSQL chi co quyen giam sat (khong dung tai khoan superuser). Sau khi xac nhan ten database/cau hinh PostgreSQL, tao tai khoan giam sat theo huong dan ben duoi.

## 3. Them metrics vao Express API

Trong thu muc backend:

```powershell
cd .\backend
npm install prom-client
```

Trong `backend/src/server.js`, them dong sau vao cac require/import:

```js
const client = require("prom-client");
```

Sau dong khoi tao `const app = express();`, them:

```js
const metricsRegistry = new client.Registry();
client.collectDefaultMetrics({ register: metricsRegistry });

app.get("/metrics", async (_req, res) => {
  try {
    res.set("Content-Type", metricsRegistry.contentType);
    res.end(await metricsRegistry.metrics());
  } catch (error) {
    res.status(500).end(error.message);
  }
});
```

Khong tao them mot `app` thu hai. Chi them mot endpoint `/metrics` vao Express app hien tai. Sau khi restart API, mo `http://localhost:5001/metrics`. Neu backend dang dung cong 5000, mo `http://localhost:5000/metrics` va sua target `host.docker.internal:5001` trong `monitoring/prometheus/prometheus.yml` thanh `host.docker.internal:5000`.

Endpoint nay danh cho monitoring noi bo. Khi trien khai that, khong de endpoint metrics cong khai qua Nginx/Internet.

## 4. Bat Grafana + Prometheus

Quay lai thu muc goc `petcare-spa`:

```powershell
docker compose --env-file .\monitoring\.env -f .\monitoring\compose.yaml config
docker compose --env-file .\monitoring\.env -f .\monitoring\compose.yaml up -d
docker compose --env-file .\monitoring\.env -f .\monitoring\compose.yaml ps
```

Mo cac dia chi:

- Grafana: http://localhost:3000 (tai khoan ban dat trong `monitoring/.env`)
- Prometheus: http://localhost:9090
- Prometheus targets: http://localhost:9090/targets
- cAdvisor: http://localhost:8080
- PostgreSQL exporter metrics: http://localhost:9187/metrics
- PetCare API metrics: http://localhost:5001/metrics (hoac cong dang dung)

Grafana datasource va dashboard PetCare duoc provision tu cac file YAML/JSON, nen sau khi stack chay thanh cong, mo Dashboards va chon `PetCare Spa - Monitoring Overview`.

## 5. Tao user chi doc de PostgreSQL exporter

Trong pgAdmin Query Tool, chay SQL sau. Thay chuoi mat khau bang dung gia tri `POSTGRES_EXPORTER_PASSWORD` trong `monitoring/.env`:

```sql
CREATE USER petcare_monitor WITH PASSWORD 'THAY_BANG_MAT_KHAU_MANH';
GRANT pg_monitor TO petcare_monitor;
```

Neu role da ton tai thi khong chay lai `CREATE USER`; doi mat khau bang `ALTER USER petcare_monitor WITH PASSWORD '...';` khi can.

PostgreSQL cai truc tiep tren Windows co the chua cho phep ket noi tu Docker Desktop qua `host.docker.internal`. Neu exporter bao loi ket noi, khong mo PostgreSQL cho tat ca dia chi Internet. Hay xem log exporter va cau hinh `listen_addresses`, `pg_hba.conf`, Windows Firewall voi pham vi cho phep hep; co the chuyen PostgreSQL vao Compose o giai doan tiep theo sau khi backup database.

## 6. Xem log va dung stack

```powershell
docker compose --env-file .\monitoring\.env -f .\monitoring\compose.yaml logs -f
docker compose --env-file .\monitoring\.env -f .\monitoring\compose.yaml down
```

Lenh `down` giu lai volume metric va Grafana. Khong dung `down -v` neu muon giu du lieu dashboard va metric.

## 7. Commit monitoring len GitHub

Sau khi da kiem tra cac file cau hinh va `.env` khong nam trong staged changes:

```powershell
git status
git add monitoring README-GITHUB-GRAFANA.md GITIGNORE-ADD.txt
git add backend/package.json backend/package-lock.json backend/src/server.js
git commit -m "feat: add Prometheus and Grafana monitoring"
git push
```

Chi add `backend/src/server.js` neu da them endpoint `/metrics`. Khong add bat ky file `.env` nao.

## Ghi chu

- cAdvisor thu thap metrics container. Tren Docker Desktop/Windows, mot so metric co the khac Linux bare-metal; neu container target DOWN, xem `docker compose logs cadvisor`.
- PetCare API can co endpoint `/metrics` moi co metric Node.js. PostgreSQL panels can postgres_exporter ket noi thanh cong.
- Cac file cau hinh Prometheus va dashboard Grafana duoc luu trong Git de giao vien kiem tra duoc.
