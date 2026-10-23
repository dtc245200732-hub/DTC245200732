
const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// =====================================
// 1. XEM DANH SÁCH LỊCH HẸN
// Admin/Staff: xem tất cả
// Customer: chỉ xem lịch hẹn của mình
// =====================================
router.get("/", requireAuth, async (req, res) => {
    try {
        const role = req.user.role;
        const userId = Number(req.user.id);

        if (!["Admin", "Staff", "Customer"].includes(role)) {
            return res.status(403).json({
                message: "Bạn không có quyền xem lịch hẹn."
            });
        }

        let sql = `
            SELECT
                a.id,
                a.customer_id,
                a.pet_id,
                a.service_id,
                a.appointment_date,
                a.status,
                a.notes,
                a.created_at,
                a.updated_at,
                u.full_name AS customer_name,
                p.name AS pet_name,
                s.name AS service_name,
                s.price AS service_price,
                s.duration AS service_duration
            FROM appointments a
            JOIN users u ON a.customer_id = u.id
            JOIN pets p ON a.pet_id = p.id
            JOIN services s ON a.service_id = s.id
        `;

        const params = [];

        if (role === "Customer") {
            sql += " WHERE a.customer_id = $1";
            params.push(userId);
        }

        sql += " ORDER BY a.appointment_date ASC";

        const result = await pool.query(sql, params);

        return res.json(result.rows);
    } catch (error) {
        console.error("Lỗi lấy danh sách lịch hẹn:", error);

        return res.status(500).json({
            message: "Lỗi máy chủ khi lấy lịch hẹn."
        });
    }
});


// =====================================
// 2. ĐẶT LỊCH DỊCH VỤ
// Customer: đặt lịch cho thú cưng của mình
// Admin/Staff: có thể tạo lịch cho khách hàng
// =====================================
router.post("/", requireAuth, async (req, res) => {
    try {
        const role = req.user.role;

        if (!["Admin", "Staff", "Customer"].includes(role)) {
            return res.status(403).json({
                message: "Bạn không có quyền đặt lịch."
            });
        }

        const {
            customer_id,
            pet_id,
            service_id,
            appointment_date,
            notes
        } = req.body;

        const petId = Number(pet_id);
        const serviceId = Number(service_id);

        // Customer luôn sử dụng ID từ JWT,
        // không tin customer_id do trình duyệt gửi lên.
        let customerId;

        if (role === "Customer") {
            customerId = Number(req.user.id);
        } else {
            customerId = Number(customer_id);
        }

        if (
            !Number.isInteger(customerId) || customerId <= 0 ||
            !Number.isInteger(petId) || petId <= 0 ||
            !Number.isInteger(serviceId) || serviceId <= 0
        ) {
            return res.status(400).json({
                message: "Thông tin khách hàng, thú cưng hoặc dịch vụ không hợp lệ."
            });
        }

        if (!appointment_date) {
            return res.status(400).json({
                message: "Vui lòng chọn ngày giờ đặt lịch."
            });
        }

        const appointmentTime = new Date(appointment_date);

        if (
            Number.isNaN(appointmentTime.getTime()) ||
            appointmentTime.getTime() <= Date.now()
        ) {
            return res.status(400).json({
                message: "Ngày giờ đặt lịch phải hợp lệ và nằm trong tương lai."
            });
        }

        // Kiểm tra khách hàng có tồn tại
        const customerResult = await pool.query(
            "SELECT id FROM users WHERE id = $1",
            [customerId]
        );

        if (customerResult.rows.length === 0) {
            return res.status(404).json({
                message: "Không tìm thấy khách hàng."
            });
        }

        // Kiểm tra thú cưng và chủ sở hữu
        const petResult = await pool.query(
            "SELECT id, customer_id FROM pets WHERE id = $1",
            [petId]
        );

        if (petResult.rows.length === 0) {
            return res.status(404).json({
                message: "Không tìm thấy thú cưng."
            });
        }

        if (
            Number(petResult.rows[0].customer_id) !== customerId
        ) {
            return res.status(403).json({
                message: "Khách hàng chỉ được đặt lịch cho thú cưng của mình."
            });
        }

        // Kiểm tra dịch vụ có tồn tại và đang hoạt động
        const serviceResult = await pool.query(
            `SELECT id FROM services
             WHERE id = $1 AND is_active = TRUE`,
            [serviceId]
        );

        if (serviceResult.rows.length === 0) {
            return res.status(404).json({
                message: "Không tìm thấy dịch vụ hoặc dịch vụ đã ngừng hoạt động."
            });
        }

        // Tạo lịch hẹn
        const result = await pool.query(
            `INSERT INTO appointments (
                customer_id,
                pet_id,
                service_id,
                appointment_date,
                status,
                notes
            )
            VALUES ($1, $2, $3, $4, 'Pending', $5)
            RETURNING *`,
            [
                customerId,
                petId,
                serviceId,
                appointment_date,
                notes ? String(notes).trim() : null
            ]
        );

        return res.status(201).json({
            message: "Đặt lịch thành công. Vui lòng chờ xác nhận.",
            appointment: result.rows[0]
        });
    } catch (error) {
        console.error("Lỗi đặt lịch:", error);

        return res.status(500).json({
            message: "Lỗi máy chủ khi đặt lịch."
        });
    }
});


// =====================================
// 3. CẬP NHẬT TRẠNG THÁI LỊCH HẸN
// Chỉ Admin/Staff được cập nhật
// =====================================
router.patch("/:id/status", requireAuth, async (req, res) => {
    try {
        if (!["Admin", "Staff"].includes(req.user.role)) {
            return res.status(403).json({
                message: "Bạn không có quyền cập nhật trạng thái lịch hẹn."
            });
        }

        const appointmentId = Number(req.params.id);
        const { status } = req.body;

        const allowedStatuses = [
            "Pending",
            "Confirmed",
            "Completed",
            "Cancelled"
        ];

        if (
            !Number.isInteger(appointmentId) ||
            appointmentId <= 0
        ) {
            return res.status(400).json({
                message: "Mã lịch hẹn không hợp lệ."
            });
        }

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                message: "Trạng thái lịch hẹn không hợp lệ."
            });
        }

        const result = await pool.query(
            `UPDATE appointments
             SET status = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [status, appointmentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Không tìm thấy lịch hẹn."
            });
        }

        return res.json({
            message: "Cập nhật trạng thái lịch hẹn thành công.",
            appointment: result.rows[0]
        });
    } catch (error) {
        console.error("Lỗi cập nhật lịch hẹn:", error);

        return res.status(500).json({
            message: "Lỗi máy chủ khi cập nhật lịch hẹn."
        });
    }
});

module.exports = router;
