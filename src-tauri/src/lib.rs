#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // SQLite storage. Schema migrations live in the frontend (src/db/migrations.ts)
        // so the browser dev build and the desktop app share one definition.
        .plugin(tauri_plugin_sql::Builder::default().build())
        // Opens trailers and links in the default browser.
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running Game Tracker");
}
