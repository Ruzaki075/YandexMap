package utils

import (
	"strings"
	"unicode"
)

// Базовый фильтр — для продакшена лучше внешний сервис или расширяемый список.
var bannedSubstrings = []string{
	"хуй", "пизд", "еба", "ёба", "бля", "сука", "мудак", "дебил",
	"fuck", "shit", "asshole",
}

func ContainsProfanity(text string) bool {
	t := strings.ToLower(strings.TrimSpace(text))
	if t == "" {
		return false
	}
	t = strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == ' ' {
			return r
		}
		return ' '
	}, t)
	for _, w := range bannedSubstrings {
		if strings.Contains(t, w) {
			return true
		}
	}
	return false
}
