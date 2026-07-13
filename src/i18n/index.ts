// Internationalization (i18n) support for Pico API.
// Supports English and Chinese

export type Locale = 'en' | 'zh-CN'

export interface LocaleConfig {
  name: string
  flag: string
}

export const LOCALES: Record<Locale, LocaleConfig> = {
  'en': { name: 'English', flag: '🇺🇸' },
  'zh-CN': { name: '中文', flag: '🇨🇳' }
}

export interface Translations {
  // App
  appName: string
  theme: string
  light: string
  dark: string
  eye: string

  // Actions
  save: string
  send: string
  cancel: string
  delete: string
  edit: string
  copy: string
  import: string
  export: string
  new: string
  more: string
  close: string
  confirm: string
  download: string
  refresh: string
  clearAll: string
  select: string
  replace: string

  // Collections
  newFolder: string
  newRequest: string
  rename: string
  duplicate: string
  deleteFolder: string
  deleteRequest: string
  moveToFolder: string
  copyAsCurl: string
  exportOpenApi: string

  // Requests
  requestName: string
  url: string
  params: string
  headers: string
  body: string
  response: string
  cookies: string
  auth: string
  preRequestScript: string
  postResponseScript: string
  scripts: string
  scriptSecurityWarning: string
  requestSettings: string
  requestTimeout: string
  timeoutMs: string
  timeoutHint: string
  redirects: string
  followRedirects: string
  followRedirectsHint: string
  maxResponseSize: string
  maxResponseSizeMb: string
  maxResponseSizeHint: string

  // Environments
  environments: string
  globals: string
  noEnvironment: string
  addVariable: string
  importEnv: string
  exportEnv: string

  // History
  history: string
  clearHistory: string
  noHistory: string

  // Capture
  capture: string
  startCapture: string
  stopCapture: string
  clearCapture: string

  // Templates
  templates: string
  oauthTemplate: string
  graphqlTemplate: string
  webhookTemplate: string

  // Settings
  settings: string
  autoSaveHistory: string
  sendBrowserCookies: string
  keyboardShortcuts: string
  captureFilterMode: string
  captureFilterApiOnly: string
  captureFilterAll: string
  captureFilterDescription: string

  // Messages
  saved: string
  deleted: string
  copied: string
  imported: string
  exported: string
  error: string
  success: string
  warning: string
  noRequests: string
  noFolders: string
  enterUrl: string
  unresolvedVariables: string

  // HTTP Methods
  GET: string
  POST: string
  PUT: string
  PATCH: string
  DELETE: string
  HEAD: string
  OPTIONS: string

  // Status codes
  status: string
  time: string
  size: string

  // Empty states
  sendRequest: string
  selectEnvironment: string
  createFolder: string
  importCollection: string
  startFresh: string

  // Quick start
  welcome: string
  tryExample: string
  quickTips: string


  // Sidebar / nav
  sidebarModeRequests: string
  sidebarModeCapture: string
  sidebarModeHistory: string
  openFullPage: string
  toggleSidebar: string
  commandPalette: string
  requestTemplates: string
  historyTitle: string
  importApi: string
  exportApi: string

  // Common labels
  key: string
  value: string
  title: string
  description: string
  scope: string
  folder: string
  preview: string
  cancel2: string

  // KV table
  addRow: string
  noParametersHint: string
  noHeadersHint: string
  browseHeaders: string
  browseValues: string
  parameterName: string
  headerName: string

  // Body editor
  bodyModeNone: string
  bodyModeUrlencoded: string
  bodyModeFormdata: string
  bodyModeRaw: string
  bodyRawJson: string
  bodyRawXml: string
  bodyRawText: string
  methodNoBodyHint: string
  noBodyHint: string
  fieldName: string
  textValue: string
  fileButton: string
  chooseFile: string
  replaceFile: string
  clear: string
  textMode: string
  addTextField: string
  addFileField: string
  filesMemoryWarning: string
  pretty: string
  raw: string
  minify: string
  validJson: string
  invalidJson: string
  validXml: string
  invalidXml: string
  requestBodyPlaceholder: string

  // RequestEditor
  unsavedChanges: string
  unsupportedProtocol: string
  invalidUrlHostname: string
  invalidUrl: string
  nothingToDuplicate: string

  // ResponsePanel
  sending: string
  largePrettyOff: string
  truncated: string
  prettyView: string
  treeView: string
  rawView: string
  pdfPreview: string
  binaryData: string
  corsError: string
  dnsError: string
  connectError: string
  tlsError: string
  timeoutError: string
  requestCancelled: string
  originalError: string
  serverError: string
  notFound: string
  unauthorized: string
  forbidden: string
  clientError: string
  openUrlNewTab: string
  requestHeaders: string
  requestBody: string

  // CollectionTree
  cannotDeleteNonEmptyFolder: string
  folderContainsContent: string
  unnamedRequest: string
  noFoldersYet: string
  createFolderHint: string
  selectedCount: string
  selectBatchHint: string
  unfiledRoot: string
  filterFolders: string
  noMatchingFolders: string

  // Environment selector / modal
  manageEnvironments: string
  globalsDescription: string
  variableName: string
  variableUsageHint: string
  noVariablesHint: string
  noGlobalsHint: string
  selectEnvironmentHint: string
  deleteConfirm: string
  deleteWarning: string

  // Import modal
  curl: string
  openapiSwagger: string
  chooseFileEllipsis: string
  pasteCurlHint: string
  pasteOpenapiHint: string
  headsUp: string
  importFromUrl: string
  fetchingUrl: string
  newFolderName: string
  invalidImportUrl: string

  // Export modal
  exportAsOpenapi: string
  exportScopeSingle: string
  exportScopeFolder: string
  exportScopeCollection: string
  descriptionOptional: string
  exportPreview: string

  // Capture panel
  capturing: string
  idle: string
  stopped: string
  startCaptureHint: string
  stopCaptureHint: string
  refreshBackground: string
  exportCaptured: string
  exportCapturedTitle: string
  searchUrlMethod: string
  methodFilter: string
  statusFilter: string
  clearFilters: string
  clearList: string
  captureStartHint: string
  captureInteractionHint: string
  curlCommands: string
  openapiJson: string
  requestsWillBeExported: string

  // History panel
  searchUrlName: string
  allMethods: string
  allStatus: string
  loading: string
  noHistoryEntries: string
  noMatchingEntries: string
  sendRequestsHistoryHint: string
  rerun: string

  // Settings modal
  appearance: string
  behavior: string
  themeDescription: string
  autoSaveDescription: string
  sendCookiesDescription: string
  language: string
  interfaceLanguage: string
  selectLanguageHint: string
  activeEnvironment: string
  noEnvironmentSelected: string
  about: string
  version: string
  languageChanged: string

  // Command palette
  searchCommandsHint: string
  noResultsFound: string
  navigateHint: string
  selectHint: string
  closeHint: string
  cmdNew: string
  cmdManageEnvs: string
  cmdImport: string
  cmdExport: string
  cmdSwitchCapture: string
  cmdSwitchRequests: string
  cmdSwitchHistory: string
  cmdTheme: string
  cmdDuplicate: string

  // Quick start
  getStartedHint: string
  tryExampleDescription: string
  importDescription: string
  startFreshDescription: string

  // Empty state
  nothingHereYet: string

  capturePermissionUnavailable: string
  capturePermissionError: string

  feedback: string
  feedbackHint: string
  githubIssues: string

  dataManagement: string
  exportAllData: string
  exportAllDataHint: string
  importAllData: string
  importAllDataHint: string
  importConfirmTitle: string
  importConfirmContent: string
  importSuccess: string
  importFailed: string
  invalidBackupFile: string

  onboardingTitle: string
  onboardingBody: string
  gotIt: string

  // Shared validation / messages
  nameRequired: string
  renameFolderTitle: string
  renameRequestTitle: string
  maxFolderDepthReached: string
  folderNameExists: string
  requestNameExists: string
  couldNotCreateFolder: string
  couldNotRenameFolder: string
  couldNotCreateRequest: string
  couldNotRenameRequest: string
  requestNotFound: string
  cannotMoveFolder: string
  moveFailed: string
  undo: string
  redo: string
  requestDuplicated: string
  nameAlreadyExists: string
  copyFailed: string
  downloadFailed: string
  downloadedFile: string
  clipboardWriteFailed: string
  cannotFormatJson: string
  cannotMinifyJson: string
  cannotFormatXml: string

  // History confirm / filters / relative time
  clearHistoryConfirmTitle: string
  clearHistoryConfirmContent: string
  status2xx: string
  status3xx: string
  status4xx: string
  status5xx: string
  timeJustNow: string
  timeDaysAgo: string
  timeHoursAgo: string
  timeMinutesAgo: string

  // Environment modal
  deleteEnvironmentTitle: string
  deleteEnvironmentContent: string
  noValidVariablesInFile: string
  importedVariablesCount: string
  failedToImportFile: string
  noVariablesToExport: string
  exportedEnvFile: string
  exportedJsonFile: string

  // Auth editor
  authTypeLabel: string
  authNoAuth: string
  authApiKey: string
  authBearerToken: string
  authBasicAuth: string
  authNoAuthorizationHint: string
  authAddTo: string
  authHeader: string
  authQueryParams: string
  authPrefixOptional: string
  authPrefix: string
  authToken: string
  authUsername: string
  authPassword: string
  authTokenSentAs: string
  authBasicSentAs: string

  // Script editor
  preRequestHint: string
  postResponseHint: string
  scriptExamplesTitle: string
  scriptExampleSetVar: string
  scriptExampleTestResponse: string

  // Response error hints
  whyThisHappens: string
  corsHintDetail: string
  dnsHintDetail: string
  connectHintDetail: string
  tlsHintDetail: string
  timeoutHintDetail: string

  // Response cookies
  cookieName: string
  cookieValue: string
  cookieDomain: string
  cookiePath: string
  cookieFlags: string
  cookieHttpOnly: string
  cookieSecure: string

  // Capture panel extras
  noRequestsToExport: string
  copiedCurlCommands: string
  failedCopyClipboard: string
  exportedOpenApi: string
  captureStarted: string
  captureStopped: string
  savedRequest: string
  loadedRequestIntoEditor: string
  exportFormatLabel: string
  capDetailUrl: string
  capDetailRequestHeaders: string
  capDetailRequestBody: string
  capDetailResponse: string
  captureDebugBannerNote: string

  // Import / templates
  importedRequestsSummary: string
  skippedDuplicatesSummary: string
  loadedFileName: string
  createdTemplate: string

  // Command palette / shortcuts
  cmdNewDesc: string
  cmdNewFolderDesc: string
  cmdImportDesc: string
  cmdExportDesc: string
  cmdFolderDesc: string
  cmdDeactivateEnvDesc: string
  variablesCount: string
  openHistoryDesc: string
  quickSwitchEnvDesc: string
  shortcutCommandPalette: string
  shortcutQuickSwitchRequest: string
  shortcutSaveRequest: string
  shortcutSendRequest: string
  shortcutDuplicateRequest: string
  shortcutUndo: string
  shortcutRedo: string
  shortcutOpenHistory: string
  shortcutSwitchEnvironment: string
  shortcutCloseModal: string
  optional: string
  saveToCollection: string
  responseTestsTab: string
}

const en: Translations = {
  appName: 'Pico API',
  theme: 'Theme',
  light: 'Light',
  dark: 'Dark',
  eye: 'Eye',

  save: 'Save',
  send: 'Send',
  cancel: 'Cancel',
  delete: 'Delete',
  edit: 'Edit',
  copy: 'Copy',
  import: 'Import',
  export: 'Export',
  new: 'New',
  more: 'More',
  close: 'Close',
  confirm: 'Confirm',
  download: 'Download',
  refresh: 'Refresh',
  clearAll: 'Clear All',
  select: 'Select',
  replace: 'Replace',

  newFolder: 'New Folder',
  newRequest: 'New Request',
  rename: 'Rename',
  duplicate: 'Duplicate',
  deleteFolder: 'Delete Folder',
  deleteRequest: 'Delete Request',
  moveToFolder: 'Move to Folder',
  copyAsCurl: 'Copy as cURL',
  exportOpenApi: 'Export as OpenAPI',

  requestName: 'Request name',
  url: 'URL',
  params: 'Params',
  headers: 'Headers',
  body: 'Body',
  response: 'Response',
  cookies: 'Cookies',
  auth: 'Auth',
  preRequestScript: 'Pre-request Script',
  postResponseScript: 'Post-response Script',
  scripts: 'Scripts',
  scriptSecurityWarning: 'Scripts run with the page\'s full permissions. Only run scripts from trusted sources.',
  requestSettings: 'Settings',
  requestTimeout: 'Request Timeout',
  timeoutMs: 'Timeout (ms)',
  timeoutHint: '0 = no timeout',
  redirects: 'Redirects',
  followRedirects: 'Follow Redirects',
  followRedirectsHint: 'Automatically follow 301, 302, 303, 307, 308 redirects',
  maxResponseSize: 'Max Response Size',
  maxResponseSizeMb: 'Max size (MB)',
  maxResponseSizeHint: '0 = no limit. Bodies larger than this are truncated.',

  environments: 'Environments',
  globals: 'Globals',
  noEnvironment: 'No Environment',
  addVariable: 'Add Variable',
  importEnv: 'Import',
  exportEnv: 'Export',

  history: 'History',
  clearHistory: 'Clear History',
  noHistory: 'No history entries',

  capture: 'Capture',
  startCapture: 'Start',
  stopCapture: 'Stop',
  clearCapture: 'Clear',

  templates: 'Templates',
  oauthTemplate: 'OAuth 2.0',
  graphqlTemplate: 'GraphQL',
  webhookTemplate: 'Webhook',

  settings: 'Settings',
  autoSaveHistory: 'Auto-save to history',
  sendBrowserCookies: 'Send browser cookies',
  keyboardShortcuts: 'Keyboard Shortcuts',
  captureFilterMode: 'Capture filter',
  captureFilterApiOnly: 'API only (Fetch/XHR)',
  captureFilterAll: 'All requests',
  captureFilterDescription: 'Takes effect on the next capture start',

  saved: 'Saved',
  deleted: 'Deleted',
  copied: 'Copied',
  imported: 'Imported',
  exported: 'Exported',
  error: 'Error',
  success: 'Success',
  warning: 'Warning',
  noRequests: 'No requests',
  noFolders: 'No folders yet',
  enterUrl: 'Please enter a URL',
  unresolvedVariables: 'Unresolved variables',

  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
  HEAD: 'HEAD',
  OPTIONS: 'OPTIONS',

  status: 'Status',
  time: 'Time',
  size: 'Size',

  sendRequest: 'Send a request to see the response',
  createFolder: 'Create a folder to get started',
  importCollection: 'Import a collection',
  startFresh: 'Start Fresh',
  selectEnvironment: 'Select Environment',

  welcome: 'Welcome to Pico API',
  tryExample: 'Try with Example',
  quickTips: 'Quick tips',

  sidebarModeRequests: 'Requests',
  sidebarModeCapture: 'Capture',
  sidebarModeHistory: 'History',
  openFullPage: 'Open full page',
  toggleSidebar: 'Toggle sidebar',
  commandPalette: 'Command Palette',
  requestTemplates: 'Request Templates',
  historyTitle: 'Request History',
  importApi: 'Import API',
  exportApi: 'Export as OpenAPI',

  key: 'Key',
  value: 'Value',
  title: 'Title',
  description: 'Description',
  scope: 'Scope',
  folder: 'Folder',
  preview: 'Preview',
  cancel2: 'Close',

  addRow: 'Add row',
  noParametersHint: 'This request has no parameters.',
  noHeadersHint: 'This request has no headers. Click + Add row to add one.',
  browseHeaders: 'Browse all common headers',
  browseValues: 'Browse suggested values',
  parameterName: 'Parameter name',
  headerName: 'Header',

  bodyModeNone: 'None',
  bodyModeUrlencoded: 'x-www-form-urlencoded',
  bodyModeFormdata: 'form-data',
  bodyModeRaw: 'raw',
  bodyRawJson: 'JSON',
  bodyRawXml: 'XML',
  bodyRawText: 'Text',
  methodNoBodyHint: "doesn't carry a body. Switch to POST / PUT / PATCH to send a request body.",
  noBodyHint: 'This request does not have a body.',
  fieldName: 'Field name',
  textValue: 'Text value',
  fileButton: 'File…',
  chooseFile: 'Choose File',
  replaceFile: 'Replace',
  clear: 'Clear',
  textMode: 'Text',
  addTextField: 'Add text field',
  addFileField: 'Add file field',
  filesMemoryWarning: 'Files chosen here live in browser memory only — they are not persisted when you save the request.',
  pretty: 'Pretty',
  raw: 'Raw',
  minify: 'Minify',
  validJson: 'Valid JSON',
  invalidJson: 'Invalid JSON',
  validXml: 'Valid XML',
  invalidXml: 'Invalid XML',
  requestBodyPlaceholder: 'Request body...',

  unsavedChanges: 'Unsaved changes',
  unsupportedProtocol: 'Unsupported protocol — only http and https are allowed.',
  invalidUrlHostname: 'Invalid URL — hostname is empty.',
  invalidUrl: 'Invalid URL',
  nothingToDuplicate: 'Nothing to duplicate',

  sending: 'Sending...',
  largePrettyOff: 'large · pretty off',
  truncated: 'truncated',
  prettyView: 'Pretty',
  treeView: 'Tree',
  rawView: 'Raw',
  pdfPreview: 'PDF Preview',
  binaryData: 'Binary data',
  corsError: 'Blocked by CORS — the server did not include this origin in Access-Control-Allow-Origin.',
  dnsError: "DNS lookup failed for the host.",
  connectError: 'Could not reach the server.',
  tlsError: 'TLS handshake failed (expired / self-signed cert?)',
  timeoutError: 'Request timed out',
  requestCancelled: 'The request was cancelled.',
  originalError: 'Original error',
  serverError: 'Server error — the API failed to handle this request.',
  notFound: 'Not Found — the URL returned no resource.',
  unauthorized: 'Unauthorized — check the Authorization header.',
  forbidden: 'Forbidden — the server rejected this request.',
  clientError: 'Client error — the request was malformed or rejected.',
  openUrlNewTab: 'Open URL in new tab',
  requestHeaders: 'Request headers',
  requestBody: 'Request body',

  cannotDeleteNonEmptyFolder: 'Cannot delete non-empty folder',
  folderContainsContent: 'This folder contains content. Please delete or move children first.',
  unnamedRequest: '(unnamed)',
  noFoldersYet: 'No folders yet.',
  createFolderHint: 'Use the button above or right-click to create one.',
  selectedCount: 'selected',
  selectBatchHint: 'Select multiple requests for batch operations',
  unfiledRoot: '— Unfiled (root) —',
  filterFolders: 'Filter folders…',
  noMatchingFolders: 'No matching folders',

  manageEnvironments: 'Manage Environments',
  globalsDescription: 'Available in every environment.',
  variableName: 'Variable name',
  variableUsageHint: 'Use {{key}} in URL / Headers / Body to interpolate.',
  noVariablesHint: 'No variables yet. Add one with + Add row.',
  noGlobalsHint: 'No global variables yet. Add one with + Add row.',
  selectEnvironmentHint: 'Select an environment or create a new one',
  deleteConfirm: 'Delete',
  deleteWarning: 'This cannot be undone.',

  curl: 'cURL',
  openapiSwagger: 'OpenAPI / Swagger',
  chooseFileEllipsis: 'Choose file…',
  pasteCurlHint: 'Paste a curl command. URL, method, headers, and body will be extracted into a new request.',
  pasteOpenapiHint: 'Paste a JSON document (openapi: 3.x or swagger: 2.x). Each operation becomes a request; tags become folders.',
  headsUp: 'Heads up',
  importFromUrl: 'From URL',
  fetchingUrl: 'Fetching…',
  newFolderName: 'New folder',
  invalidImportUrl: 'Invalid URL — paste a direct link to a .json or .yaml file.',

  exportAsOpenapi: 'Export as OpenAPI',
  exportScopeSingle: 'Current Request',
  exportScopeFolder: 'Folder',
  exportScopeCollection: 'Collection',
  descriptionOptional: 'Optional — appears in the OpenAPI info block',
  exportPreview: 'Preview',

  capturing: 'Capturing…',
  idle: 'Idle',
  stopped: 'Stopped',
  startCaptureHint: 'Start capturing this tab',
  stopCaptureHint: 'Stop capture',
  refreshBackground: 'Refresh from background',
  exportCaptured: 'Export captured requests',
  exportCapturedTitle: 'Export Captured Requests',
  searchUrlMethod: 'Search URL, method...',
  methodFilter: 'Method:',
  statusFilter: 'Status:',
  clearFilters: 'Clear filters',
  clearList: 'Clear list',
  captureStartHint: 'Click Start to begin capturing network requests from this tab.',
  captureInteractionHint: 'Double-click to load · click to expand · save icon to keep',
  curlCommands: 'cURL Commands',
  openapiJson: 'OpenAPI JSON',
  requestsWillBeExported: 'request(s) will be exported',

  searchUrlName: 'Search URL, name...',
  allMethods: 'All Methods',
  allStatus: 'All Status',
  loading: 'Loading...',
  noHistoryEntries: 'No history entries',
  noMatchingEntries: 'No entries match your filters',
  sendRequestsHistoryHint: 'Send some requests to see them here',
  rerun: 'Re-run',

  appearance: 'Appearance',
  behavior: 'Behavior',
  themeDescription: 'Choose your preferred color scheme',
  autoSaveDescription: 'Automatically record all sent requests',
  sendCookiesDescription: 'Include cookies from the current browser context',
  language: 'Language',
  interfaceLanguage: 'Interface Language',
  selectLanguageHint: 'Select your preferred language',
  activeEnvironment: 'Active Environment',
  noEnvironmentSelected: 'No environment selected',
  about: 'About',
  version: 'Version',
  languageChanged: 'Language changed',

  searchCommandsHint: 'Search requests, environments, or commands…',
  noResultsFound: 'No matches',
  navigateHint: 'navigate',
  selectHint: 'select',
  closeHint: 'close',
  cmdNew: 'New Request',
  cmdManageEnvs: 'Manage Environments…',
  cmdImport: 'Import from cURL / OpenAPI…',
  cmdExport: 'Export as OpenAPI…',
  cmdSwitchCapture: 'Switch to Capture mode',
  cmdSwitchRequests: 'Switch to Requests mode',
  cmdSwitchHistory: 'Switch to History mode',
  cmdTheme: 'Theme',
  cmdDuplicate: 'Duplicate current request',

  getStartedHint: 'Get started by creating a folder, importing an existing collection, or trying an example.',
  tryExampleDescription: 'Create a sample folder with example requests to explore the features.',
  importDescription: 'Import from cURL, OpenAPI, or Postman Collection',
  startFreshDescription: 'Create a new empty folder to organize your requests.',

  nothingHereYet: 'Nothing here yet',

  capturePermissionUnavailable: "Your Chrome version doesn't support capturing from this extension.",
  capturePermissionError: 'Failed to start capture.',

  feedback: 'Feedback',
  feedbackHint: 'Report bugs or suggest features on GitHub',
  githubIssues: 'Open GitHub Issues',

  dataManagement: 'Data Management',
  exportAllData: 'Export All Data',
  exportAllDataHint: 'Save all folders, requests, environments, globals, and history as a single JSON file.',
  importAllData: 'Import Data',
  importAllDataHint: 'Restore from a previously exported JSON file. This will replace all current data.',
  importConfirmTitle: 'Import data?',
  importConfirmContent: 'This will replace ALL current data (folders, requests, environments, globals, history). Continue?',
  importSuccess: 'Imported successfully',
  importFailed: 'Import failed',
  invalidBackupFile: 'Invalid backup file format',

  onboardingTitle: 'Welcome to Pico API',
  onboardingBody: 'Create a folder to organize your requests, import an existing collection, or just start sending requests. Use ⌘K / Ctrl+K to open the command palette anytime.',
  gotIt: 'Got it',

  nameRequired: 'Name is required',
  renameFolderTitle: 'Rename Folder',
  renameRequestTitle: 'Rename Request',
  maxFolderDepthReached: 'Maximum folder depth ({n}) reached',
  folderNameExists: 'A folder with this name already exists here',
  requestNameExists: 'A request with this name already exists here',
  couldNotCreateFolder: 'Could not create folder',
  couldNotRenameFolder: 'Could not rename folder',
  couldNotCreateRequest: 'Could not create request',
  couldNotRenameRequest: 'Could not rename request',
  requestNotFound: 'Request not found',
  cannotMoveFolder: 'Cannot move folder (depth, cycle, or sibling constraint)',
  moveFailed: 'Move failed',
  undo: 'Undo',
  redo: 'Redo',
  requestDuplicated: 'Request duplicated',
  nameAlreadyExists: '"{name}" already exists in this location.',
  copyFailed: 'Copy failed',
  downloadFailed: 'Download failed',
  downloadedFile: 'Downloaded {name}',
  clipboardWriteFailed: 'Could not write to clipboard',
  cannotFormatJson: 'Cannot format: {reason}',
  cannotMinifyJson: 'Cannot minify: {reason}',
  cannotFormatXml: 'Cannot format: {reason}',

  clearHistoryConfirmTitle: 'Clear History?',
  clearHistoryConfirmContent: 'This will permanently delete all history entries. This action cannot be undone.',
  status2xx: '2xx Success',
  status3xx: '3xx Redirect',
  status4xx: '4xx Client Error',
  status5xx: '5xx Server Error',
  timeJustNow: 'Just now',
  timeDaysAgo: '{n}d ago',
  timeHoursAgo: '{n}h ago',
  timeMinutesAgo: '{n}m ago',

  deleteEnvironmentTitle: 'Delete "{name}"?',
  deleteEnvironmentContent: 'Variables defined here will be removed. This cannot be undone.',
  noValidVariablesInFile: 'No valid variables found in file',
  importedVariablesCount: 'Imported {n} variable(s)',
  failedToImportFile: 'Failed to import file',
  noVariablesToExport: 'No variables to export',
  exportedEnvFile: 'Exported as .env file',
  exportedJsonFile: 'Exported as JSON',

  authTypeLabel: 'Type',
  authNoAuth: 'No Auth',
  authApiKey: 'API Key',
  authBearerToken: 'Bearer Token',
  authBasicAuth: 'Basic Auth',
  authNoAuthorizationHint: 'This request does not use any authorization.',
  authAddTo: 'Add to',
  authHeader: 'Header',
  authQueryParams: 'Query Params',
  authPrefixOptional: '(optional)',
  authPrefix: 'Prefix',
  authToken: 'Token',
  authUsername: 'Username',
  authPassword: 'Password',
  authTokenSentAs: 'The token will be sent as:',
  authBasicSentAs: 'Credentials will be sent as:',

  preRequestHint: 'Runs before the request is sent. Use to set variables, add timestamps, etc.',
  postResponseHint: 'Runs after the response is received. Use to verify status, extract values into variables, etc.',
  scriptExamplesTitle: 'Example snippets:',
  scriptExampleSetVar: 'Set a variable:',
  scriptExampleTestResponse: 'Test response:',

  whyThisHappens: 'Why this happens:',
  corsHintDetail: 'The server didn\'t include this origin in Access-Control-Allow-Origin. The response is actually there — the browser just hides it from fetch.',
  dnsHintDetail: 'The hostname doesn\'t exist or DNS can\'t resolve it. Double-check spelling.',
  connectHintDetail: 'Nothing is listening on this host:port, or a firewall is blocking it. Make sure the server is running.',
  tlsHintDetail: 'TLS handshake failed — typically an expired or self-signed certificate.',
  timeoutHintDetail: 'The request exceeded the browser\'s default timeout.',

  cookieName: 'Name',
  cookieValue: 'Value',
  cookieDomain: 'Domain',
  cookiePath: 'Path',
  cookieFlags: 'Flags',
  cookieHttpOnly: 'HttpOnly',
  cookieSecure: 'Secure',

  noRequestsToExport: 'No requests to export',
  copiedCurlCommands: 'Copied {n} cURL command(s)',
  failedCopyClipboard: 'Failed to copy to clipboard',
  exportedOpenApi: 'Exported as OpenAPI',
  captureStarted: 'Capture started',
  captureStopped: 'Capture stopped',
  savedRequest: 'Saved "{name}"',
  loadedRequestIntoEditor: 'Loaded "{name}" into editor',
  exportFormatLabel: 'Export format:',
  capDetailUrl: 'URL',
  capDetailRequestHeaders: 'Request headers',
  capDetailRequestBody: 'Request body',
  capDetailResponse: 'Response',
  captureDebugBannerNote: 'The browser will show a "this tab is being debugged" banner while capture is on — that\'s normal. Stop capture to dismiss it.',

  importedRequestsSummary: 'Imported {n} request(s)',
  skippedDuplicatesSummary: ', skipped {n} duplicate(s)',
  loadedFileName: 'Loaded {name}',
  createdTemplate: 'Created "{name}" template',

  cmdNewDesc: 'Create a new empty request',
  cmdNewFolderDesc: 'Create a new folder',
  cmdImportDesc: 'Import from cURL or OpenAPI',
  cmdExportDesc: 'Export as OpenAPI',
  cmdFolderDesc: 'Folder',
  cmdDeactivateEnvDesc: 'Deactivate active environment',
  variablesCount: '{n} variables',
  openHistoryDesc: 'Open History',
  quickSwitchEnvDesc: 'Quick Switch Environment',
  shortcutCommandPalette: 'Command Palette',
  shortcutQuickSwitchRequest: 'Quick Switch Request',
  shortcutSaveRequest: 'Save Request',
  shortcutSendRequest: 'Send Request',
  shortcutDuplicateRequest: 'Duplicate Request',
  shortcutUndo: 'Undo',
  shortcutRedo: 'Redo',
  shortcutOpenHistory: 'Open History',
  shortcutSwitchEnvironment: 'Switch Environment',
  shortcutCloseModal: 'Close Modal / Panel',
  optional: 'optional',
  saveToCollection: 'Save to collection',
  responseTestsTab: 'Tests'
}

const zhCN: Translations = {
  appName: 'Pico API',
  theme: '主题',
  light: '浅色',
  dark: '深色',
  eye: '护眼',

  save: '保存',
  send: '发送',
  cancel: '取消',
  delete: '删除',
  edit: '编辑',
  copy: '复制',
  import: '导入',
  export: '导出',
  new: '新建',
  more: '更多',
  close: '关闭',
  confirm: '确认',
  download: '下载',
  refresh: '刷新',
  clearAll: '全部清空',
  select: '选择',
  replace: '替换',

  newFolder: '新建文件夹',
  newRequest: '新建请求',
  rename: '重命名',
  duplicate: '复制',
  deleteFolder: '删除文件夹',
  deleteRequest: '删除请求',
  moveToFolder: '移动到文件夹',
  copyAsCurl: '复制为 cURL',
  exportOpenApi: '导出为 OpenAPI',

  requestName: '请求名称',
  url: 'URL',
  params: '参数',
  headers: '请求头',
  body: '请求体',
  response: '响应',
  cookies: 'Cookies',
  auth: '认证',
  preRequestScript: '前置脚本',
  postResponseScript: '响应后脚本',
  scripts: '脚本',
  scriptSecurityWarning: '脚本以页面完整权限运行。仅执行可信来源的脚本。',
  requestSettings: '设置',
  requestTimeout: '请求超时',
  timeoutMs: '超时时间 (毫秒)',
  timeoutHint: '0 = 不设置超时',
  redirects: '重定向',
  followRedirects: '跟随重定向',
  followRedirectsHint: '自动跟随 301, 302, 303, 307, 308 重定向',
  maxResponseSize: '响应大小上限',
  maxResponseSizeMb: '上限 (MB)',
  maxResponseSizeHint: '0 = 不限制。超过此大小的响应将被截断。',

  environments: '环境',
  globals: '全局变量',
  noEnvironment: '无环境',
  addVariable: '添加变量',
  importEnv: '导入',
  exportEnv: '导出',

  history: '历史记录',
  clearHistory: '清空历史',
  noHistory: '暂无历史记录',

  capture: '抓包',
  startCapture: '开始',
  stopCapture: '停止',
  clearCapture: '清空',

  templates: '模板',
  oauthTemplate: 'OAuth 2.0',
  graphqlTemplate: 'GraphQL',
  webhookTemplate: 'Webhook',

  settings: '设置',
  autoSaveHistory: '自动保存历史',
  sendBrowserCookies: '发送浏览器 Cookie',
  keyboardShortcuts: '快捷键',
  captureFilterMode: '抓包过滤',
  captureFilterApiOnly: '仅 API (Fetch/XHR)',
  captureFilterAll: '所有请求',
  captureFilterDescription: '下次开始抓包时生效',

  saved: '已保存',
  deleted: '已删除',
  copied: '已复制',
  imported: '已导入',
  exported: '已导出',
  error: '错误',
  success: '成功',
  warning: '警告',
  noRequests: '暂无请求',
  noFolders: '暂无文件夹',
  enterUrl: '请输入 URL',
  unresolvedVariables: '未解析的变量',

  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
  HEAD: 'HEAD',
  OPTIONS: 'OPTIONS',

  status: '状态码',
  time: '耗时',
  size: '大小',

  sendRequest: '发送请求以查看响应',
  createFolder: '创建一个文件夹开始使用',
  importCollection: '导入集合',
  startFresh: '从零开始',
  selectEnvironment: '选择环境',

  welcome: '欢迎使用 Pico API',
  tryExample: '试试示例',
  quickTips: '使用提示',

  sidebarModeRequests: '请求',
  sidebarModeCapture: '抓包',
  sidebarModeHistory: '历史',
  openFullPage: '打开完整页面',
  toggleSidebar: '切换侧边栏',
  commandPalette: '命令面板',
  requestTemplates: '请求模板',
  historyTitle: '请求历史',
  importApi: '导入 API',
  exportApi: '导出为 OpenAPI',

  key: '键',
  value: '值',
  title: '标题',
  description: '描述',
  scope: '范围',
  folder: '文件夹',
  preview: '预览',
  cancel2: '关闭',

  addRow: '添加行',
  noParametersHint: '此请求没有参数。',
  noHeadersHint: '此请求没有请求头。点击 + 添加行新建一个。',
  browseHeaders: '浏览常用请求头',
  browseValues: '浏览建议值',
  parameterName: '参数名',
  headerName: '请求头',

  bodyModeNone: '无',
  bodyModeUrlencoded: 'x-www-form-urlencoded',
  bodyModeFormdata: 'form-data',
  bodyModeRaw: 'raw',
  bodyRawJson: 'JSON',
  bodyRawXml: 'XML',
  bodyRawText: 'Text',
  methodNoBodyHint: '不携带请求体。切换到 POST / PUT / PATCH 才能发送请求体。',
  noBodyHint: '此请求没有请求体。',
  fieldName: '字段名',
  textValue: '文本值',
  fileButton: '文件…',
  chooseFile: '选择文件',
  replaceFile: '替换',
  clear: '清除',
  textMode: '文本',
  addTextField: '添加文本字段',
  addFileField: '添加文件字段',
  filesMemoryWarning: '此处选择的文件仅存在浏览器内存中，保存请求时不会持久化。',
  pretty: '美化',
  raw: 'Raw',
  minify: '压缩',
  validJson: 'JSON 有效',
  invalidJson: 'JSON 无效',
  validXml: 'XML 有效',
  invalidXml: 'XML 无效',
  requestBodyPlaceholder: '请求体...',

  unsavedChanges: '未保存的修改',
  unsupportedProtocol: '不支持的协议 — 仅允许 http 和 https。',
  invalidUrlHostname: 'URL 无效 — 主机名为空。',
  invalidUrl: 'URL 无效',
  nothingToDuplicate: '没有可复制的内容',

  sending: '发送中...',
  largePrettyOff: '较大 · 已关闭美化',
  truncated: '已截断',
  prettyView: '美化',
  treeView: '树形',
  rawView: 'Raw',
  pdfPreview: 'PDF 预览',
  binaryData: '二进制数据',
  corsError: '被 CORS 拦截 — 服务器未在 Access-Control-Allow-Origin 中包含此来源。',
  dnsError: '主机名 DNS 解析失败。',
  connectError: '无法连接到服务器。',
  tlsError: 'TLS 握手失败（证书过期 / 自签名？）',
  timeoutError: '请求超时',
  requestCancelled: '请求已取消。',
  originalError: '原始错误',
  serverError: '服务器错误 — API 处理此请求失败。',
  notFound: '未找到 — URL 未返回资源。',
  unauthorized: '未授权 — 请检查 Authorization 请求头。',
  forbidden: '禁止访问 — 服务器拒绝了此请求。',
  clientError: '客户端错误 — 请求格式错误或被拒绝。',
  openUrlNewTab: '在新标签页打开 URL',
  requestHeaders: '请求头',
  requestBody: '请求体',

  cannotDeleteNonEmptyFolder: '无法删除非空文件夹',
  folderContainsContent: '此文件夹包含内容。请先删除或移动子节点。',
  unnamedRequest: '(未命名)',
  noFoldersYet: '暂无文件夹。',
  createFolderHint: '使用上方按钮或右键创建一个。',
  selectedCount: '已选',
  selectBatchHint: '选择多个请求进行批量操作',
  unfiledRoot: '— 未归档（根）—',
  filterFolders: '过滤文件夹…',
  noMatchingFolders: '没有匹配的文件夹',

  manageEnvironments: '管理环境',
  globalsDescription: '在所有环境中可用。',
  variableName: '变量名',
  variableUsageHint: '在 URL / 请求头 / 请求体中使用 {{key}} 进行插值。',
  noVariablesHint: '暂无变量。点击 + 添加行新建。',
  noGlobalsHint: '暂无全局变量。点击 + 添加行新建。',
  selectEnvironmentHint: '选择环境或新建一个',
  deleteConfirm: '删除',
  deleteWarning: '此操作不可撤销。',

  curl: 'cURL',
  openapiSwagger: 'OpenAPI / Swagger',
  chooseFileEllipsis: '选择文件…',
  pasteCurlHint: '粘贴 cURL 命令。URL、方法、请求头、请求体将被提取为新请求。',
  pasteOpenapiHint: '粘贴 JSON 文档（openapi: 3.x 或 swagger: 2.x）。每个 operation 成为一个请求；tags 转为文件夹。',
  headsUp: '提示',
  importFromUrl: '从 URL 导入',
  fetchingUrl: '正在获取…',
  newFolderName: '新建文件夹',
  invalidImportUrl: '链接无效 — 请粘贴 .json 或 .yaml 文件的直接链接。',

  exportAsOpenapi: '导出为 OpenAPI',
  exportScopeSingle: '当前请求',
  exportScopeFolder: '文件夹',
  exportScopeCollection: '整个集合',
  descriptionOptional: '可选 — 出现在 OpenAPI info 块中',
  exportPreview: '预览',

  capturing: '抓包中…',
  idle: '空闲',
  stopped: '已停止',
  startCaptureHint: '开始抓取此标签页',
  stopCaptureHint: '停止抓包',
  refreshBackground: '从后台刷新',
  exportCaptured: '导出抓包请求',
  exportCapturedTitle: '导出抓包请求',
  searchUrlMethod: '搜索 URL、方法...',
  methodFilter: '方法：',
  statusFilter: '状态：',
  clearFilters: '清除过滤',
  clearList: '清空列表',
  captureStartHint: '点击开始抓取此标签页的网络请求。',
  captureInteractionHint: '双击加载 · 单击展开 · 保存图标保留',
  curlCommands: 'cURL 命令',
  openapiJson: 'OpenAPI JSON',
  requestsWillBeExported: '个请求将被导出',

  searchUrlName: '搜索 URL、名称...',
  allMethods: '全部方法',
  allStatus: '全部状态',
  loading: '加载中...',
  noHistoryEntries: '暂无历史记录',
  noMatchingEntries: '没有匹配的记录',
  sendRequestsHistoryHint: '发送一些请求即可在此查看',
  rerun: '重新运行',

  appearance: '外观',
  behavior: '行为',
  themeDescription: '选择您喜欢的配色方案',
  autoSaveDescription: '自动记录所有已发送的请求',
  sendCookiesDescription: '包含当前浏览器上下文的 cookies',
  language: '语言',
  interfaceLanguage: '界面语言',
  selectLanguageHint: '选择您喜欢的语言',
  activeEnvironment: '当前环境',
  noEnvironmentSelected: '未选择环境',
  about: '关于',
  version: '版本',
  languageChanged: '语言已切换',

  searchCommandsHint: '搜索请求、环境或命令…',
  noResultsFound: '无匹配',
  navigateHint: '导航',
  selectHint: '选择',
  closeHint: '关闭',
  cmdNew: '新建请求',
  cmdManageEnvs: '管理环境…',
  cmdImport: '从 cURL / OpenAPI 导入…',
  cmdExport: '导出为 OpenAPI…',
  cmdSwitchCapture: '切换到抓包模式',
  cmdSwitchRequests: '切换到请求模式',
  cmdSwitchHistory: '切换到历史模式',
  cmdTheme: '主题',
  cmdDuplicate: '复制当前请求',

  getStartedHint: '通过创建文件夹、导入现有集合或试用示例开始使用。',
  tryExampleDescription: '创建一个示例文件夹，包含示例请求以探索功能。',
  importDescription: '从 cURL、OpenAPI 或 Postman 集合导入',
  startFreshDescription: '创建一个新的空文件夹来组织您的请求。',

  nothingHereYet: '暂无内容',

  // debugger 是必需的, 不会再有运行时申请弹窗; 保留 "unavailable" / "error" 两个 key
  // 仅作为 manifest 配置错误时的 fallback 文案
  capturePermissionUnavailable: '当前 Chrome 版本不支持此扩展的抓包功能。',
  capturePermissionError: '抓包启动失败。',

  feedback: '反馈',
  feedbackHint: '在 GitHub 上报告问题或建议功能',
  githubIssues: '打开 GitHub Issues',

  dataManagement: '数据管理',
  exportAllData: '导出所有数据',
  exportAllDataHint: '将所有文件夹、请求、环境、全局变量和历史记录保存为一个 JSON 文件。',
  importAllData: '导入数据',
  importAllDataHint: '从之前导出的 JSON 文件恢复。这会覆盖当前所有数据。',
  importConfirmTitle: '确认导入？',
  importConfirmContent: '将覆盖当前所有数据（文件夹、请求、环境、全局变量、历史）。是否继续？',
  importSuccess: '导入成功',
  importFailed: '导入失败',
  invalidBackupFile: '无效的备份文件格式',

  onboardingTitle: '欢迎使用 Pico API',
  onboardingBody: '创建文件夹来组织请求，导入现有集合，或直接发送请求。随时按 ⌘K / Ctrl+K 打开命令面板。',
  gotIt: '知道了',

  nameRequired: '名称不能为空',
  renameFolderTitle: '重命名文件夹',
  renameRequestTitle: '重命名请求',
  maxFolderDepthReached: '已达到最大文件夹深度 ({n})',
  folderNameExists: '此位置已存在同名文件夹',
  requestNameExists: '此位置已存在同名请求',
  couldNotCreateFolder: '无法创建文件夹',
  couldNotRenameFolder: '无法重命名文件夹',
  couldNotCreateRequest: '无法创建请求',
  couldNotRenameRequest: '无法重命名请求',
  requestNotFound: '未找到请求',
  cannotMoveFolder: '无法移动文件夹（深度、循环或同级约束）',
  moveFailed: '移动失败',
  undo: '撤销',
  redo: '重做',
  requestDuplicated: '请求已复制',
  nameAlreadyExists: '「{name}」在此位置已存在。',
  copyFailed: '复制失败',
  downloadFailed: '下载失败',
  downloadedFile: '已下载 {name}',
  clipboardWriteFailed: '无法写入剪贴板',
  cannotFormatJson: '无法格式化：{reason}',
  cannotMinifyJson: '无法压缩：{reason}',
  cannotFormatXml: '无法格式化：{reason}',

  clearHistoryConfirmTitle: '清空历史记录？',
  clearHistoryConfirmContent: '将永久删除所有历史记录，此操作不可撤销。',
  status2xx: '2xx 成功',
  status3xx: '3xx 重定向',
  status4xx: '4xx 客户端错误',
  status5xx: '5xx 服务器错误',
  timeJustNow: '刚刚',
  timeDaysAgo: '{n} 天前',
  timeHoursAgo: '{n} 小时前',
  timeMinutesAgo: '{n} 分钟前',

  deleteEnvironmentTitle: '删除「{name}」？',
  deleteEnvironmentContent: '此处定义的变量将被移除，此操作不可撤销。',
  noValidVariablesInFile: '文件中未找到有效变量',
  importedVariablesCount: '已导入 {n} 个变量',
  failedToImportFile: '导入文件失败',
  noVariablesToExport: '没有可导出的变量',
  exportedEnvFile: '已导出为 .env 文件',
  exportedJsonFile: '已导出为 JSON',

  authTypeLabel: '类型',
  authNoAuth: '无认证',
  authApiKey: 'API Key',
  authBearerToken: 'Bearer Token',
  authBasicAuth: 'Basic Auth',
  authNoAuthorizationHint: '此请求未使用任何认证。',
  authAddTo: '添加到',
  authHeader: '请求头',
  authQueryParams: '查询参数',
  authPrefixOptional: '（可选）',
  authPrefix: '前缀',
  authToken: 'Token',
  authUsername: '用户名',
  authPassword: '密码',
  authTokenSentAs: 'Token 将以如下形式发送：',
  authBasicSentAs: '凭据将以如下形式发送：',

  preRequestHint: '在请求发送前运行。可用于设置变量、添加时间戳等。',
  postResponseHint: '在收到响应后运行。可用于验证状态、提取变量等。',
  scriptExamplesTitle: '示例片段：',
  scriptExampleSetVar: '设置变量：',
  scriptExampleTestResponse: '测试响应：',

  whyThisHappens: '原因：',
  corsHintDetail: '服务器未在 Access-Control-Allow-Origin 中包含此来源。响应其实存在，但浏览器对 fetch 隐藏了它。',
  dnsHintDetail: '主机名不存在或 DNS 无法解析，请检查拼写。',
  connectHintDetail: '此 host:port 无服务监听，或被防火墙拦截。请确认服务已启动。',
  tlsHintDetail: 'TLS 握手失败 — 通常是证书过期或自签名。',
  timeoutHintDetail: '请求超过了浏览器默认超时时间。',

  cookieName: '名称',
  cookieValue: '值',
  cookieDomain: '域名',
  cookiePath: '路径',
  cookieFlags: '标志',
  cookieHttpOnly: 'HttpOnly',
  cookieSecure: 'Secure',

  noRequestsToExport: '没有可导出的请求',
  copiedCurlCommands: '已复制 {n} 条 cURL 命令',
  failedCopyClipboard: '复制到剪贴板失败',
  exportedOpenApi: '已导出为 OpenAPI',
  captureStarted: '抓包已开始',
  captureStopped: '抓包已停止',
  savedRequest: '已保存「{name}」',
  loadedRequestIntoEditor: '已将「{name}」加载到编辑器',
  exportFormatLabel: '导出格式：',
  capDetailUrl: 'URL',
  capDetailRequestHeaders: '请求头',
  capDetailRequestBody: '请求体',
  capDetailResponse: '响应',
  captureDebugBannerNote: '抓包时浏览器会显示「此标签页正在被调试」横幅，属正常现象。停止抓包即可关闭。',

  importedRequestsSummary: '已导入 {n} 个请求',
  skippedDuplicatesSummary: '，跳过 {n} 个重复项',
  loadedFileName: '已加载 {name}',
  createdTemplate: '已创建「{name}」模板',

  cmdNewDesc: '创建新的空请求',
  cmdNewFolderDesc: '创建新文件夹',
  cmdImportDesc: '从 cURL 或 OpenAPI 导入',
  cmdExportDesc: '导出为 OpenAPI',
  cmdFolderDesc: '文件夹',
  cmdDeactivateEnvDesc: '取消激活当前环境',
  variablesCount: '{n} 个变量',
  openHistoryDesc: '打开历史记录',
  quickSwitchEnvDesc: '快速切换环境',
  shortcutCommandPalette: '命令面板',
  shortcutQuickSwitchRequest: '快速切换请求',
  shortcutSaveRequest: '保存请求',
  shortcutSendRequest: '发送请求',
  shortcutDuplicateRequest: '复制请求',
  shortcutUndo: '撤销',
  shortcutRedo: '重做',
  shortcutOpenHistory: '打开历史记录',
  shortcutSwitchEnvironment: '切换环境',
  shortcutCloseModal: '关闭弹窗 / 面板',
  optional: '可选',
  saveToCollection: '保存到集合',
  responseTestsTab: '测试'
}

export const translations: Record<Locale, Translations> = {
  'en': en,
  'zh-CN': zhCN
}

export function getTranslation(locale: Locale): Translations {
  return translations[locale] || en
}

/** Replace `{key}` placeholders in a translation string. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`))
}

// Language detection helper
export function detectLocale(): Locale {
  const stored = localStorage.getItem('mp2:locale')
  if (stored && (stored === 'en' || stored === 'zh-CN')) {
    return stored as Locale
  }

  const browserLang = navigator.language
  if (browserLang.startsWith('zh')) {
    return 'zh-CN'
  }
  return 'en'
}
