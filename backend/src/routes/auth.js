
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const {
    requireAuth,
    allowRoles
} = require("../middleware/auth");

const router = express.Router();

// API 1: Dang ky tai khoan Customer
router.post("/register", async (req, res) => {
    try {
        const { full_name, email, password } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({
                message: "Vui long nhap ho ten, email va mat khau"
            });
        }

        if (typeof password !== "string" || password.length < 8) {
            return res.status(400).json({
                message: "Mat khau phai co it nhat 8 ky tu"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [normalizedEmail]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                message: "Email da duoc su dung"
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users
                (full_name, email, password_hash, role, is_active)
             VALUES ($1, $2, $3, 'CUSTOMER', TRUE)
             RETURNING id, full_name, email, role`,
            [full_name.trim(), normalizedEmail, passwordHash]
        );

        return res.status(201).json({
            message: "Dang ky tai khoan thanh cong",
            user: result.rows[0]
        });
    } catch (error) {
        console.error("Register error:", error.message);

        return res.status(500).json({
            message: "Loi server khi dang ky tai khoan"
        });
    }
});

// API 2: Dang nhap va cap JWT
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Vui long nhap email va mat khau"
            });
        }

        const result = await pool.query(
            `SELECT id, full_name, email, password_hash, role, is_active
             FROM users
             WHERE email = $1`,
            [email.trim().toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: "Email hoac mat khau khong dung"
            });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(403).json({
                message: "Tai khoan da bi vo hieu hoa"
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Email hoac mat khau khong dung"
            });
        }

        if (!process.env.JWT_SECRET) {
            throw new Error("Thieu JWT_SECRET trong file .env");
        }

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRES_IN || "1h"
            }
        );

        return res.json({
            message: "Dang nhap thanh cong",
            token,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            message: "Loi server khi dang nhap"
        });
    }
});

// API 3: Xem thong tin tai khoan dang dang nhap
router.get("/me", requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, full_name, email, role, is_active
             FROM users
             WHERE id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Khong tim thay tai khoan"
            });
        }

        return res.json({
            user: result.rows[0]
        });
    } catch (error) {
        console.error("Get profile error:", error.message);

        return res.status(500).json({
            message: "Loi server khi lay thong tin tai khoan"
        });
    }
});

// API 4: Chi Admin moi duoc truy cap
router.get(
    "/admin-test",
    requireAuth,
   allowRoles("ADMIN") ,
    (req, res) => {
        return res.json({
            message: "Ban co quyen Admin"
        });
    }
);

module.exports = router;
