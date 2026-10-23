
const jwt = require("jsonwebtoken");

// Xac thuc token dang nhap
function requireAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({
            message: "Ban can dang nhap"
        });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);

        // Chuan hoa vai tro
        if (req.user.role) {
            req.user.role = String(req.user.role)
                .trim()
                .toUpperCase();
        }

        next();
    } catch (error) {
        return res.status(401).json({
            message: "Token khong hop le hoac da het han"
        });
    }
}

// Kiem tra quyen theo vai tro
function allowRoles(...roles) {
    const normalizedRoles = roles.map(role =>
        String(role).trim().toUpperCase()
    );

    return (req, res, next) => {
        const userRole = String(req.user?.role || "")
            .trim()
            .toUpperCase();

        console.log("===== KIEM TRA QUYEN =====");
        console.log("User role:", userRole);
        console.log("Required roles:", normalizedRoles);
        console.log("==========================");

        if (!req.user || !normalizedRoles.includes(userRole)) {
            return res.status(403).json({
                message: "Ban khong co quyen thuc hien"
            });
        }

        next();
    };
}

module.exports = {
    requireAuth,
    allowRoles
};
