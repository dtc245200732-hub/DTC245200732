
const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function getRole(req) {
    return String(req.user?.role || "").trim().toUpperCase();
}

// Quy doi so tuoi thanh ngay sinh de luu vao PostgreSQL
function ageToBirthDate(age) {
    if (age === undefined || age === null || age === "") {
        return null;
    }

    const birth = new Date();
    birth.setFullYear(birth.getFullYear() - Number(age));

    return birth.toISOString().slice(0, 10);
}

// Tinh tuoi tu ngay sinh
function calculateAge(birthDate) {
    if (!birthDate) return null;

    const birth = new Date(String(birthDate).slice(0, 10) + "T00:00:00");
    const today = new Date();

    let age = today.getFullYear() - birth.getFullYear();

    if (
        today.getMonth() < birth.getMonth() ||
        (
            today.getMonth() === birth.getMonth() &&
            today.getDate() < birth.getDate()
        )
    ) {
        age--;
    }

    return Math.max(0, age);
}

// Tra ve du lieu dung voi frontend
function formatPet(pet) {
    return {
        ...pet,
        age: calculateAge(pet.birth_date),
        weight: pet.weight_kg,
        health_status: pet.health_notes,
        vaccination_history: pet.vaccination_notes
    };
}

// LAY DANH SACH THU CUNG
router.get("/", requireAuth, async (req, res) => {
    try {
        const role = getRole(req);
        let result;

        if (role === "ADMIN" || role === "STAFF") {
            result = await pool.query(`
                SELECT *
                FROM pets
                ORDER BY id DESC
            `);
        } else if (role === "CUSTOMER") {
            result = await pool.query(`
                SELECT *
                FROM pets
                WHERE customer_id = $1
                ORDER BY id DESC
            `, [req.user.id]);
        } else {
            return res.status(403).json({
                message: "Ban khong co quyen xem thu cung"
            });
        }

        return res.json(result.rows.map(formatPet));
    } catch (error) {
        console.error("Loi lay danh sach thu cung:", error);
        return res.status(500).json({
            message: "Loi may chu khi lay danh sach thu cung"
        });
    }
});

// THEM THU CUNG
router.post("/", requireAuth, async (req, res) => {
    try {
        const role = getRole(req);

        if (role !== "ADMIN" && role !== "CUSTOMER") {
            return res.status(403).json({
                message: "Ban khong co quyen them thu cung"
            });
        }

        const {
            name,
            species,
            breed,
            age,
            weight,
            health_status,
            vaccination_history
        } = req.body;

        if (
            typeof name !== "string" || !name.trim() ||
            typeof species !== "string" || !species.trim()
        ) {
            return res.status(400).json({
                message: "Vui long nhap ten va loai thu cung"
            });
        }

        if (
            age !== undefined && age !== null && age !== "" &&
            (!Number.isInteger(Number(age)) || Number(age) < 0)
        ) {
            return res.status(400).json({
                message: "Tuoi phai la so nguyen khong am"
            });
        }

        if (
            weight !== undefined && weight !== null && weight !== "" &&
            (!Number.isFinite(Number(weight)) || Number(weight) <= 0)
        ) {
            return res.status(400).json({
                message: "Can nang phai lon hon 0"
            });
        }

        let customerId = req.user.id;

        if (role === "ADMIN" && req.body.customer_id) {
            customerId = Number(req.body.customer_id);

            if (!Number.isInteger(customerId) || customerId <= 0) {
                return res.status(400).json({
                    message: "Ma khach hang khong hop le"
                });
            }
        }

        const result = await pool.query(`
            INSERT INTO pets (
                customer_id,
                name,
                species,
                breed,
                birth_date,
                weight_kg,
                health_notes,
                vaccination_notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            customerId,
            name.trim(),
            species.trim(),
            breed?.trim() || null,
            age === undefined || age === null || age === ""
                ? null : ageToBirthDate(age),
            weight === undefined || weight === null || weight === ""
                ? null : Number(weight),
            health_status?.trim() || null,
            vaccination_history?.trim() || null
        ]);

        return res.status(201).json({
            message: "Them thu cung thanh cong",
            pet: formatPet(result.rows[0])
        });
    } catch (error) {
        console.error("Loi them thu cung:", error);
        return res.status(500).json({
            message: "Loi may chu khi them thu cung"
        });
    }
});

// SUA THU CUNG
router.put("/:id", requireAuth, async (req, res) => {
    try {
        const petId = Number(req.params.id);
        const role = getRole(req);

        if (!Number.isInteger(petId) || petId <= 0) {
            return res.status(400).json({
                message: "Ma thu cung khong hop le"
            });
        }

        const current = await pool.query(
            "SELECT * FROM pets WHERE id = $1",
            [petId]
        );

        if (current.rows.length === 0) {
            return res.status(404).json({
                message: "Khong tim thay thu cung"
            });
        }

        const pet = current.rows[0];

        if (
            role !== "ADMIN" &&
            !(
                role === "CUSTOMER" &&
                Number(pet.customer_id) === Number(req.user.id)
            )
        ) {
            return res.status(403).json({
                message: "Ban khong co quyen sua thu cung nay"
            });
        }

        const {
            name,
            species,
            breed,
            age,
            weight,
            health_status,
            vaccination_history
        } = req.body;

        if (
            typeof name !== "string" || !name.trim() ||
            typeof species !== "string" || !species.trim()
        ) {
            return res.status(400).json({
                message: "Vui long nhap ten va loai thu cung"
            });
        }

        if (
            age !== undefined && age !== null && age !== "" &&
            (!Number.isInteger(Number(age)) || Number(age) < 0)
        ) {
            return res.status(400).json({
                message: "Tuoi phai la so nguyen khong am"
            });
        }

        if (
            weight !== undefined && weight !== null && weight !== "" &&
            (!Number.isFinite(Number(weight)) || Number(weight) <= 0)
        ) {
            return res.status(400).json({
                message: "Can nang phai lon hon 0"
            });
        }

        const birthDate =
            age === undefined
                ? pet.birth_date
                : age === null || age === ""
                    ? null
                    : ageToBirthDate(age);

        const weightKg =
            weight === undefined
                ? pet.weight_kg
                : weight === null || weight === ""
                    ? null
                    : Number(weight);

        const result = await pool.query(`
            UPDATE pets
            SET name = $1,
                species = $2,
                breed = $3,
                birth_date = $4,
                weight_kg = $5,
                health_notes = $6,
                vaccination_notes = $7
            WHERE id = $8
            RETURNING *
        `, [
            name.trim(),
            species.trim(),
            breed?.trim() || null,
            birthDate,
            weightKg,
            health_status?.trim() || null,
            vaccination_history?.trim() || null,
            petId
        ]);

        return res.json({
            message: "Cap nhat thu cung thanh cong",
            pet: formatPet(result.rows[0])
        });
    } catch (error) {
        console.error("Loi cap nhat thu cung:", error);
        return res.status(500).json({
            message: "Loi may chu khi cap nhat thu cung"
        });
    }
});

// XOA THU CUNG
router.delete("/:id", requireAuth, async (req, res) => {
    try {
        const petId = Number(req.params.id);
        const role = getRole(req);

        if (!Number.isInteger(petId) || petId <= 0) {
            return res.status(400).json({
                message: "Ma thu cung khong hop le"
            });
        }

        const current = await pool.query(
            "SELECT * FROM pets WHERE id = $1",
            [petId]
        );

        if (current.rows.length === 0) {
            return res.status(404).json({
                message: "Khong tim thay thu cung"
            });
        }

        const pet = current.rows[0];

        if (
            role !== "ADMIN" &&
            !(
                role === "CUSTOMER" &&
                Number(pet.customer_id) === Number(req.user.id)
            )
        ) {
            return res.status(403).json({
                message: "Ban khong co quyen xoa thu cung nay"
            });
        }

        await pool.query(
            "DELETE FROM pets WHERE id = $1",
            [petId]
        );

        return res.json({
            message: "Xoa thu cung thanh cong"
        });
    } catch (error) {
        console.error("Loi xoa thu cung:", error);
        return res.status(500).json({
            message: "Loi may chu khi xoa thu cung"
        });
    }
});

module.exports = router;
