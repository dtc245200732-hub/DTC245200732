const express = require("express");
const pool = require("../db");
const { requireAuth, allowRoles } = require("../middleware/auth");


const router = express.Router();

// GET: Lay danh sach dich vu
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM services ORDER BY id DESC"
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Get services error:", error.message);
        res.status(500).json({
            message: "Khong the lay danh sach dich vu"
        });
    }
});

// GET: Lay chi tiet mot dich vu
router.get("/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({
                message: "Ma dich vu khong hop le"
            });
        }

        const result = await pool.query(
            "SELECT * FROM services WHERE id = $1",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Khong tim thay dich vu"
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Get service error:", error.message);
        res.status(500).json({
            message: "Khong the lay thong tin dich vu"
        });
    }
});

// POST: Them dich vu
router.post("/", requireAuth, allowRoles("ADMIN"), async (req, res) => {
    try {
        const {
            name,
            category,
            description = "",
            price,
            duration_minutes
        } = req.body;

        if (
            typeof name !== "string" || !name.trim() ||
            typeof category !== "string" || !category.trim() ||
            price === "" || price === null ||
            !Number.isFinite(Number(price)) || Number(price) < 0 ||
            !Number.isInteger(Number(duration_minutes)) ||
            Number(duration_minutes) <= 0
        ) {
            return res.status(400).json({
                message: "Vui long nhap ten, danh muc, gia va thoi luong hop le"
            });
        }

        const result = await pool.query(
            `INSERT INTO services
                (name, category, description, price, duration_minutes)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [
                name.trim(),
                category.trim(),
                description,
                Number(price),
                Number(duration_minutes)
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Create service error:", error.message);
        res.status(500).json({
            message: "Khong the them dich vu"
        });
    }
});

// PUT: Cap nhat dich vu
router.put("/:id", requireAuth, allowRoles("ADMIN"), async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({
                message: "Ma dich vu khong hop le"
            });
        }

        const {
            name,
            category,
            description = "",
            price,
            duration_minutes,
            is_active = true
        } = req.body;

        if (
            typeof name !== "string" || !name.trim() ||
            typeof category !== "string" || !category.trim() ||
            price === "" || price === null ||
            !Number.isFinite(Number(price)) || Number(price) < 0 ||
            !Number.isInteger(Number(duration_minutes)) ||
            Number(duration_minutes) <= 0 ||
            typeof is_active !== "boolean"
        ) {
            return res.status(400).json({
                message: "Thong tin cap nhat khong hop le"
            });
        }

        const result = await pool.query(
            `UPDATE services
             SET name = $1,
                 category = $2,
                 description = $3,
                 price = $4,
                 duration_minutes = $5,
                 is_active = $6,
                 updated_at = NOW()
             WHERE id = $7
             RETURNING *`,
            [
                name.trim(),
                category.trim(),
                description,
                Number(price),
                Number(duration_minutes),
                is_active,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Khong tim thay dich vu"
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Update service error:", error.message);
        res.status(500).json({
            message: "Khong the cap nhat dich vu"
        });
    }
});

// DELETE: Xoa dich vu
router.delete("/:id", requireAuth, allowRoles("ADMIN"), async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({
                message: "Ma dich vu khong hop le"
            });
        }

        const result = await pool.query(
            "DELETE FROM services WHERE id = $1 RETURNING id",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Khong tim thay dich vu"
            });
        }

        res.json({
            message: "Da xoa dich vu",
            id: result.rows[0].id
        });
    } catch (error) {
        console.error("Delete service error:", error.message);
        res.status(500).json({
            message: "Khong the xoa dich vu"
        });
    }
});

module.exports = router;
