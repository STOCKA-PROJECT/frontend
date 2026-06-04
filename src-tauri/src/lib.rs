use keyring::Entry;

/// Keychain service name under which the session tokens are stored. Pairs with a fixed account
/// label so there is a single secure entry per machine user (the app namespaces accounts itself).
const KEYCHAIN_SERVICE: &str = "es.stocka.desktop";
const KEYCHAIN_ACCOUNT: &str = "session";

fn entry() -> Result<Entry, String> {
    Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT).map_err(|e| e.to_string())
}

/// Persists the serialized session tokens in the OS keychain (macOS Keychain / Windows Credential
/// Manager / Secret Service on Linux), so they survive restarts and never touch disk in clear text.
#[tauri::command]
fn keychain_save(value: String) -> Result<(), String> {
    entry()?.set_password(&value).map_err(|e| e.to_string())
}

/// Loads the serialized session tokens, or `None` when no entry exists yet.
#[tauri::command]
fn keychain_load() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Clears the stored tokens (logout); a missing entry is treated as success.
#[tauri::command]
fn keychain_clear() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      keychain_save,
      keychain_load,
      keychain_clear
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
