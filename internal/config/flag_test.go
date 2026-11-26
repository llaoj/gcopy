package config

import "testing"

func TestEnvOr(t *testing.T) {
	t.Run("returns fallback when unset", func(t *testing.T) {
		if got := EnvOr("unset-string-flag", "default"); got != "default" {
			t.Fatalf("got %q, want default", got)
		}
		if got := EnvOr("unset-bool-flag", true); got != true {
			t.Fatalf("got %v, want true", got)
		}
		if got := EnvOr("unset-int-flag", 42); got != 42 {
			t.Fatalf("got %d, want 42", got)
		}
	})

	t.Run("parses string bool and int environment variables", func(t *testing.T) {
		t.Setenv("GCOPY_LISTEN", "127.0.0.1:8443")
		t.Setenv("GCOPY_DEBUG", "true")
		t.Setenv("GCOPY_MAX_MEMORY", "1024")

		if got := EnvOr("listen", ":3375"); got != "127.0.0.1:8443" {
			t.Fatalf("got %q, want 127.0.0.1:8443", got)
		}
		if got := EnvOr("debug", false); got != true {
			t.Fatalf("got %v, want true", got)
		}
		if got := EnvOr("max-memory", 512); got != 1024 {
			t.Fatalf("got %d, want 1024", got)
		}
	})

	t.Run("falls back on invalid bool int or unsupported type", func(t *testing.T) {
		t.Setenv("GCOPY_DEBUG", "not-a-bool")
		t.Setenv("GCOPY_MAX_MEMORY", "not-an-int")
		t.Setenv("GCOPY_FLOAT_TEST", "3.14")

		if got := EnvOr("debug", false); got != false {
			t.Fatalf("invalid bool: got %v, want false", got)
		}
		if got := EnvOr("max-memory", 512); got != 512 {
			t.Fatalf("invalid int: got %d, want 512", got)
		}
		if got := EnvOr("float-test", 1.5); got != 1.5 {
			t.Fatalf("unsupported type: got %v, want 1.5", got)
		}
	})
}

func TestConfigValidate(t *testing.T) {
	validBase := Config{
		AppKey:           "0123456789abcdef",
		Listen:           ":3375",
		MaxContentLength: 10,
		MaxMemory:        512,
	}

	if err := validBase.Validate(); err != nil {
		t.Fatalf("expected valid config, got error: %v", err)
	}

	unlimitedMemory := validBase
	unlimitedMemory.MaxMemory = 0
	if err := unlimitedMemory.Validate(); err != nil {
		t.Fatalf("MaxMemory=0 (unlimited) should be valid, got: %v", err)
	}

	invalidCases := []struct {
		name   string
		mutate func(*Config)
	}{
		{"empty app-key", func(c *Config) { c.AppKey = "" }},
		{"short app-key", func(c *Config) { c.AppKey = "short-key-15chr" }},
		{"zero max-content-length", func(c *Config) { c.MaxContentLength = 0 }},
		{"negative max-content-length", func(c *Config) { c.MaxContentLength = -5 }},
		{"negative max-memory", func(c *Config) { c.MaxMemory = -1 }},
		{"max-memory smaller than max-content-length", func(c *Config) { c.MaxMemory = 5; c.MaxContentLength = 10 }},
	}

	for _, tc := range invalidCases {
		t.Run(tc.name, func(t *testing.T) {
			candidate := validBase
			tc.mutate(&candidate)
			if err := candidate.Validate(); err == nil {
				t.Fatalf("expected validation error for %s, got nil", tc.name)
			}
		})
	}
}
