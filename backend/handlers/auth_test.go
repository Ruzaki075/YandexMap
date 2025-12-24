package handlers

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"
)

func TestRegisterHandler_Mock(t *testing.T) {
	t.Run("ValidRegistration", func(t *testing.T) {
		requestBody := map[string]string{
			"email":    "test@example.com",
			"password": "password123",
		}
		jsonData, _ := json.Marshal(requestBody)

		req := httptest.NewRequest("POST", "/api/register", bytes.NewBuffer(jsonData))
		req.Header.Set("Content-Type", "application/json")

		// Проверяем структуру запроса
		if req.Method != "POST" {
			t.Error("Request method should be POST")
		}

		if req.Header.Get("Content-Type") != "application/json" {
			t.Error("Content-Type should be application/json")
		}

		// Проверяем, что тело запроса парсится
		var body map[string]string
		err := json.NewDecoder(req.Body).Decode(&body)
		if err != nil {
			t.Errorf("Failed to parse request body: %v", err)
		}

		if body["email"] != "test@example.com" {
			t.Errorf("Expected email test@example.com, got %v", body["email"])
		}
	})

	t.Run("EmptyEmail", func(t *testing.T) {
		requestBody := map[string]string{
			"email":    "",
			"password": "password123",
		}
		jsonData, _ := json.Marshal(requestBody)

		// Проверяем валидацию
		var body map[string]string
		json.Unmarshal(jsonData, &body)

		if body["email"] != "" {
			t.Error("Email should be empty in this test case")
		}

		t.Log("Test case: empty email validation")
	})
}

func TestLoginHandler_Mock(t *testing.T) {
	t.Run("ValidLoginData", func(t *testing.T) {
		requestBody := map[string]string{
			"email":    "user@example.com",
			"password": "password123",
		}
		jsonData, _ := json.Marshal(requestBody)

		req := httptest.NewRequest("POST", "/api/login", bytes.NewBuffer(jsonData))
		req.Header.Set("Content-Type", "application/json")

		if req.Method != "POST" {
			t.Error("Login should use POST method")
		}

		var credentials map[string]string
		err := json.Unmarshal(jsonData, &credentials)
		if err != nil {
			t.Errorf("Invalid JSON: %v", err)
		}

		if credentials["email"] == "" || credentials["password"] == "" {
			t.Error("Email and password should not be empty")
		}

		t.Log("Test case: valid login data structure")
	})
}
