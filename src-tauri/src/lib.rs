use keyring::Entry;

/// Keychain service name under which secrets are stored. Each secret uses a distinct account label
/// (e.g. "session" for the auth tokens, "db_key" for the local database encryption key), so the app
/// keeps several independent secure entries per machine user.
const KEYCHAIN_SERVICE: &str = "es.stocka.desktop";
const DEFAULT_ACCOUNT: &str = "session";

fn entry(account: Option<String>) -> Result<Entry, String> {
    let account = account.unwrap_or_else(|| DEFAULT_ACCOUNT.to_string());
    Entry::new(KEYCHAIN_SERVICE, &account).map_err(|e| e.to_string())
}

/// Persists a secret in the OS keychain (macOS Keychain / Windows Credential Manager / Secret
/// Service on Linux), so it survives restarts and never touches disk in clear text.
#[tauri::command]
fn keychain_save(value: String, account: Option<String>) -> Result<(), String> {
    entry(account)?.set_password(&value).map_err(|e| e.to_string())
}

/// Loads a stored secret, or `None` when no entry exists yet.
#[tauri::command]
fn keychain_load(account: Option<String>) -> Result<Option<String>, String> {
    match entry(account)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Clears a stored secret; a missing entry is treated as success.
#[tauri::command]
fn keychain_clear(account: Option<String>) -> Result<(), String> {
    match entry(account)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
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
