package middleware

import (
	"context"
	"net/http"
	"os"
	"strings"

	"github.com/dgrijalva/jwt-go"
)

var JwtKey = []byte("your-secret-key-change-in-production")

func init() {
	if k := os.Getenv("JWT_SECRET"); k != "" {
		JwtKey = []byte(k)
	}
}

type contextKey string

const userIDKey contextKey = "user_id"
const isModeratorKey contextKey = "is_moderator"
const isAdminKey contextKey = "is_admin"

type Claims struct {
	UserID      int    `json:"user_id"`
	Email       string `json:"email"`
	IsModerator bool   `json:"is_moderator"`
	IsAdmin     bool   `json:"is_admin"`
	jwt.StandardClaims
}

func JWTMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Authorization header required", http.StatusUnauthorized)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, "Invalid authorization format", http.StatusUnauthorized)
			return
		}

		tokenStr := parts[1]

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
			return JwtKey, nil
		})

		if err != nil || !token.Valid {
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), userIDKey, claims.UserID)
		ctx = context.WithValue(ctx, isModeratorKey, claims.IsModerator)
		ctx = context.WithValue(ctx, isAdminKey, claims.IsAdmin)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func GetUserIDFromContext(ctx context.Context) (int, bool) {
	userID, ok := ctx.Value(userIDKey).(int)
	return userID, ok
}

func GetIsModeratorFromContext(ctx context.Context) bool {
	v, ok := ctx.Value(isModeratorKey).(bool)
	return ok && v
}

func GetIsAdminFromContext(ctx context.Context) bool {
	v, ok := ctx.Value(isAdminKey).(bool)
	return ok && v
}
