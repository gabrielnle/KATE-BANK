🎯 **What:** Added tests for the `testConnection` method in `StellarClient` to ensure it properly handles the expected `404` bypass and correctly re-throws other errors.
📊 **Coverage:**
  - Added tests for `testConnection` returning `{ connected: true }` when no error is thrown (Happy Path).
  - Added tests verifying that `testConnection` bypasses a `404` status code error from `server.loadAccount` and returns `{ connected: true }`.
  - Added tests ensuring that other network or general errors from `server.loadAccount` are properly caught and re-thrown.
✨ **Result:** Improved test coverage for `StellarClient` and ensured correct behavior regarding Horizon server connection status, preventing future regressions.
