require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const client = require("prom-client");
const morgan = require("morgan");
const fs = require("fs");
const path = require("path");
const pool = require("./db");

// Khai báo các router
const petsRouter = require("./routes/pets");
const servicesRouter = require("./routes/services");
const authRouter = require("./routes/auth");
const appointmentsRouter = require("./routes/appointments");

const app = express();

// Tao thu muc logs neu chua ton tai
const logDirectory = path.join(__dirname, "../logs");
fs.mkdirSync(logDirectory, { recursive: true });

// Ghi log HTTP vao file cho Promtail doc
const logStream = fs.createWriteStream(
    path.join(logDirectory, "petcare.log"),
    { flags: "a" }
);

app.use(morgan("combined", { stream: logStream }));

// Middleware
app.use(helmet());

app.use(cors({
    origin: [
        process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5500",
        "http://localhost:5500"
    ]
}));

app.use(express.json());


/* ==============================
   PROMETHEUS METRICS
================================ */

const register = new client.Registry();

client.collectDefaultMetrics({
    register: register
});

// Endpoint cung cap metrics cho Prometheus
app.get("/metrics", async (req, res) => {
    try {
        res.set("Content-Type", register.contentType);
        res.end(await register.metrics());
    } catch (error) {
        console.error("Metrics error:", error.message);
        res.status(500).end("Khong lay duoc metrics");
    }
});

console.log("servicesRouter:", typeof servicesRouter);
console.log("authRouter:", typeof authRouter);

// Định tuyến API
app.use("/api/pets", petsRouter);
app.use("/api/services", servicesRouter);
app.use("/api/auth", authRouter);
app.use("/api/appointments", appointmentsRouter);


// API kiểm tra backend và PostgreSQL
app.get("/api/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");

        res.json({
            status: "ok",
            message: "PetCare API va PostgreSQL dang hoat dong"
        });
    } catch (error) {
        console.error("Health check failed:", error.message);

        res.status(503).json({
            status: "error",
            message: "Khong ket noi duoc co so du lieu"
        });
    }
});

// Khởi động server
const port = Number(process.env.PORT || 5000);

app.listen(port, () => {
    console.log(`PetCare API running on port ${port}`);
});