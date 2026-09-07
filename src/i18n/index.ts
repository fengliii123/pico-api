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
  sendStreaming: string
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

  // History
  history: string
  clearHistory: string

  // Templates
  templates: string

  // Settings
  settings: string
  autoSaveHistory: string
  sendBrowserCookies: string
  keyboardShortcuts: string

  // Messages
  saved: string
  deleted: string
  copied: string
  imported: string
  unitOperations: string
  unitTags: string
  duplicatesSkipped: string
  exported: string
  error: string
  success: string
  warning: string
  enterUrl: string

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
  createFolder: string

  // Quick start
  tryExample: string


  // Sidebar / nav
  historyTitle: string
  importApi: string

  // Common labels
  key: string
  value: string
  title: string
  description: string
  scope: string
  folder: string
  preview: string

  // KV table
  addRow: string
  noParametersHint: string
  noHeadersHint: string
  browseHeaders: string
  browseValues: string
  headerName: string

  // Body editor
  bodyModeUrlencoded: string
  bodyModeFormdata: string
  bodyModeRaw: string
  methodNoBodyHint: string
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
  nothingToDuplicate: string

  // ResponsePanel
  sending: string
  largePrettyOff: string
  jsonSearchPlaceholder: string
  expandAllBtn: string
  collapseAllBtn: string
  truncated: string
  prettyView: string
  treeView: string
  rawView: string
  pdfPreview: string
  binaryData: string
  noResponseBody: string
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
  deleteWarning: string

  // Import modal
  curl: string
  openapiSwagger: string
  chooseFileEllipsis: string
  pasteCurlHint: string
  pasteOpenapiHint: string
  headsUp: string
  importFromUrl: string
  newFolderName: string
  invalidImportUrl: string
  apifox: string
  apifoxProjectId: string
  apifoxAccessToken: string
  apifoxHint: string
  fetchFromApifox: string
  apifoxTokenInvalid: string
  apifoxProjectNotFound: string

  // Export modal
  exportAsOpenapi: string
  exportScopeSingle: string
  exportScopeFolder: string
  exportScopeCollection: string
  descriptionOptional: string

  // History panel
  searchUrlName: string
  allMethods: string
  allStatus: string
  loading: string
  receiving: string
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
  cmdImport: string
  cmdExport: string

  // Quick start

  // Empty state
  nothingHereYet: string

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
  nothingToImport: string
  pasteFirst: string
  couldNotParse: string
  couldNotParseCurl: string
  fileTooLarge: string
  couldNotReadFile: string

  onboardingTitle: string
  onboardingBody: string
  skip: string
  examplesFolderName: string
  exampleGetUser: string
  examplePostEcho: string

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

  // Import / templates
  importedRequestsSummary: string
  skippedDuplicatesSummary: string
  loadedFileName: string

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
  responseTestsTab: string

  // Misc placeholders
  paramName: string
  myApiRequest: string
  myApi: string
  authPrefixExample: string
  authBearerDefault: string
  deleteSelected: string
  deleteSelectedConfirm: string
  copyPath: string
  ratingPromptTitle: string
  ratingPromptContent: string
  ratingPromptGo: string
  ratingPromptLater: string

  // Request pipeline error messages (useRequestExecution)
  errUnsupportedProtocol: string
  errEmptyHostname: string
  errUrlParse: string
  errCouldNotParseUrl: string
  errUnresolvedVariables: string
  errNoEnvironment: string
  errInvalidRequest: string
  errCouldNotNormalize: string
  errInvalidUrl: string
  errInvalidUrlHostname: string
  errCouldNotParse: string
  errRequestFailed: string
  errTimeout: string
}

const en: Translations = {
  appName: 'Pico API',
  theme: 'Theme',
  light: 'Light',
  dark: 'Dark',
  eye: 'Eye',

  save: 'Save',
  send: 'Send',
  sendStreaming: 'Stream',
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

  history: 'History',
  clearHistory: 'Clear History',

  templates: 'Templates',

  settings: 'Settings',
  autoSaveHistory: 'Auto-save to history',
  sendBrowserCookies: 'Send browser cookies',
  keyboardShortcuts: 'Keyboard Shortcuts',

  saved: 'Saved',
  deleted: 'Deleted',
  copied: 'Copied',
  imported: 'Imported',
  unitOperations: 'operations',
  unitTags: 'tags',
  duplicatesSkipped: 'duplicates skipped',
  exported: 'Exported',
  error: 'Error',
  success: 'Success',
  warning: 'Warning',
  enterUrl: 'Please enter a URL',

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

  tryExample: 'Try with Example',

  historyTitle: 'Request History',
  importApi: 'Import API',

  key: 'Key',
  value: 'Value',
  title: 'Title',
  description: 'Description',
  scope: 'Scope',
  folder: 'Folder',
  preview: 'Preview',

  addRow: 'Add row',
  noParametersHint: 'This request has no parameters.',
  noHeadersHint: 'This request has no headers. Click + Add row to add one.',
  browseHeaders: 'Browse all common headers',
  browseValues: 'Browse suggested values',
  headerName: 'Header',

  bodyModeUrlencoded: 'x-www-form-urlencoded',
  bodyModeFormdata: 'form-data',
  bodyModeRaw: 'raw',
  methodNoBodyHint: "doesn't carry a body. Switch to POST / PUT / PATCH to send a request body.",
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
  nothingToDuplicate: 'Nothing to duplicate',

  sending: 'Sending...',
  largePrettyOff: 'large · pretty off',
  jsonSearchPlaceholder: 'Search keys or values…',
  expandAllBtn: 'Expand',
  collapseAllBtn: 'Collapse',
  truncated: 'truncated',
  prettyView: 'Pretty',
  treeView: 'Tree',
  rawView: 'Raw',
  pdfPreview: 'PDF Preview',
  binaryData: 'Binary data',
  noResponseBody: 'No response body',
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
  deleteWarning: 'This cannot be undone.',

  curl: 'cURL',
  openapiSwagger: 'OpenAPI / Swagger',
  chooseFileEllipsis: 'Choose file…',
  pasteCurlHint: 'Paste a curl command. URL, method, headers, and body will be extracted into a new request.',
  pasteOpenapiHint: 'Paste a JSON document (openapi: 3.x or swagger: 2.x). Each operation becomes a request; tags become folders.',
  headsUp: 'Heads up',
  importFromUrl: 'From URL',
  newFolderName: 'New folder',
  invalidImportUrl: 'Invalid URL — paste a direct link to a .json or .yaml file.',
  apifox: 'Apifox',
  apifoxProjectId: 'Project ID',
  apifoxAccessToken: 'Access Token',
  apifoxHint: 'Find Project ID in the Apifox project URL. Generate a token at Account Settings → API Access Token.',
  fetchFromApifox: 'Fetch from Apifox',
  apifoxTokenInvalid: 'Access token is invalid or lacks permission for this project.',
  apifoxProjectNotFound: 'Project not found — check the Project ID.',

  exportAsOpenapi: 'Export as OpenAPI',
  exportScopeSingle: 'Current Request',
  exportScopeFolder: 'Folder',
  exportScopeCollection: 'Collection',
  descriptionOptional: 'Optional — appears in the OpenAPI info block',

  searchUrlName: 'Search URL, name...',
  allMethods: 'All Methods',
  allStatus: 'All Status',
  loading: 'Loading...',
  receiving: 'Receiving...',
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
  cmdImport: 'Import from cURL / OpenAPI…',
  cmdExport: 'Export as OpenAPI…',


  nothingHereYet: 'Nothing here yet',

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
  nothingToImport: 'Nothing to import',
  pasteFirst: 'Paste something first',
  couldNotParse: 'Could not parse',
  couldNotParseCurl: 'Could not parse this cURL command',
  fileTooLarge: 'File too large: {size} MB — limit is 10 MB',
  couldNotReadFile: 'Could not read file',

  onboardingTitle: 'Welcome to Pico API',
  onboardingBody: 'Send your first request in 10 seconds — press the button below, then hit Send. Everything stays on this machine: no account, no cloud, no tracking.',
  skip: 'Skip',
  examplesFolderName: 'Examples',
  exampleGetUser: 'Get a demo user (JSON)',
  examplePostEcho: 'Echo a POST with JSON body',

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

  importedRequestsSummary: 'Imported {n} request(s)',
  skippedDuplicatesSummary: ', skipped {n} duplicate(s)',
  loadedFileName: 'Loaded {name}',

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
  responseTestsTab: 'Tests',

  // Misc placeholders
  paramName: 'Parameter name',
  myApiRequest: 'My API request',
  myApi: 'My API',
  authPrefixExample: 'e.g. Token for Bearer, leave empty for none',
  authBearerDefault: 'Bearer (default)',
  deleteSelected: 'Delete selected ({n})',
  deleteSelectedConfirm: 'Delete the {n} selected history entries?',
  copyPath: 'Copy path',
  ratingPromptTitle: 'Enjoying Pico API?',
  ratingPromptContent: 'If it helps your daily work, a rating on the Chrome Web Store helps other developers find it. Takes 10 seconds.',
  ratingPromptGo: 'Rate it',
  ratingPromptLater: 'Maybe later',

  // Request pipeline error messages (useRequestExecution)
  errUnsupportedProtocol: '{label}: unsupported protocol {protocol} — only http and https are allowed.',
  errEmptyHostname: '{label}: hostname is empty.',
  errUrlParse: '{label}: {message}',
  errCouldNotParseUrl: 'could not parse URL',
  errUnresolvedVariables: 'Unresolved variables: {names}. Activate an environment that defines {names}, or add {names} to your active environment\'s variables. (Active: {envName}.)',
  errNoEnvironment: 'No Environment',
  errInvalidRequest: 'Invalid request: {message}',
  errCouldNotNormalize: 'could not normalize',
  errInvalidUrl: 'Invalid URL: {message}',
  errInvalidUrlHostname: 'Invalid URL — hostname is empty.',
  errCouldNotParse: 'could not parse',
  errRequestFailed: 'Request failed',
  errTimeout: 'Request timed out'
}

const zhCN: Translations = {
  appName: 'Pico API',
  theme: '主题',
  light: '浅色',
  dark: '深色',
  eye: '护眼',

  save: '保存',
  send: '发送',
  sendStreaming: '流式',
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

  history: '历史记录',
  clearHistory: '清空历史',

  templates: '模板',

  settings: '设置',
  autoSaveHistory: '自动保存历史',
  sendBrowserCookies: '发送浏览器 Cookie',
  keyboardShortcuts: '快捷键',

  saved: '已保存',
  deleted: '已删除',
  copied: '已复制',
  imported: '已导入',
  unitOperations: '个接口',
  unitTags: '个标签',
  duplicatesSkipped: '个重复已跳过',
  exported: '已导出',
  error: '错误',
  success: '成功',
  warning: '警告',
  enterUrl: '请输入 URL',

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

  tryExample: '试试示例',

  historyTitle: '请求历史',
  importApi: '导入 API',

  key: '键',
  value: '值',
  title: '标题',
  description: '描述',
  scope: '范围',
  folder: '文件夹',
  preview: '预览',

  addRow: '添加行',
  noParametersHint: '此请求没有参数。',
  noHeadersHint: '此请求没有请求头。点击 + 添加行新建一个。',
  browseHeaders: '浏览常用请求头',
  browseValues: '浏览建议值',
  headerName: '请求头',

  bodyModeUrlencoded: 'x-www-form-urlencoded',
  bodyModeFormdata: 'form-data',
  bodyModeRaw: 'raw',
  methodNoBodyHint: '不携带请求体。切换到 POST / PUT / PATCH 才能发送请求体。',
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
  nothingToDuplicate: '没有可复制的内容',

  sending: '发送中...',
  largePrettyOff: '较大 · 已关闭美化',
  jsonSearchPlaceholder: '搜索键或值…',
  expandAllBtn: '展开全部',
  collapseAllBtn: '折叠全部',
  truncated: '已截断',
  prettyView: '美化',
  treeView: '树形',
  rawView: 'Raw',
  pdfPreview: 'PDF 预览',
  binaryData: '二进制数据',
  noResponseBody: '无响应内容',
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
  deleteWarning: '此操作不可撤销。',

  curl: 'cURL',
  openapiSwagger: 'OpenAPI / Swagger',
  chooseFileEllipsis: '选择文件…',
  pasteCurlHint: '粘贴 cURL 命令。URL、方法、请求头、请求体将被提取为新请求。',
  pasteOpenapiHint: '粘贴 JSON 文档（openapi: 3.x 或 swagger: 2.x）。每个 operation 成为一个请求；tags 转为文件夹。',
  headsUp: '提示',
  importFromUrl: '从 URL 导入',
  newFolderName: '新建文件夹',
  invalidImportUrl: '链接无效 — 请粘贴 .json 或 .yaml 文件的直接链接。',
  apifox: 'Apifox',
  apifoxProjectId: '项目 ID',
  apifoxAccessToken: 'Access Token',
  apifoxHint: '项目 ID 在 Apifox 项目 URL 中查看；Token 在「账号设置 → API 访问令牌」生成。',
  fetchFromApifox: '从 Apifox 拉取',
  apifoxTokenInvalid: 'Access Token 无效或没有该项目的访问权限。',
  apifoxProjectNotFound: '项目不存在 — 请检查项目 ID。',

  exportAsOpenapi: '导出为 OpenAPI',
  exportScopeSingle: '当前请求',
  exportScopeFolder: '文件夹',
  exportScopeCollection: '整个集合',
  descriptionOptional: '可选 — 出现在 OpenAPI info 块中',

  searchUrlName: '搜索 URL、名称...',
  allMethods: '全部方法',
  allStatus: '全部状态',
  loading: '加载中...',
  receiving: '请求中...',
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
  cmdImport: '从 cURL / OpenAPI 导入…',
  cmdExport: '导出为 OpenAPI…',


  nothingHereYet: '暂无内容',

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
  nothingToImport: '没有可导入的内容',
  pasteFirst: '请先粘贴内容',
  couldNotParse: '解析失败',
  couldNotParseCurl: '无法解析这条 cURL 命令',
  fileTooLarge: '文件过大：{size} MB，上限 10 MB',
  couldNotReadFile: '无法读取文件',
  invalidBackupFile: '无效的备份文件格式',

  onboardingTitle: '欢迎使用 Pico API',
  onboardingBody: '10 秒发出你的第一个请求——点击下面的按钮，然后按发送。所有数据都保存在本机：无账号、无云端、无追踪。',
  skip: '跳过',
  examplesFolderName: '示例',
  exampleGetUser: '获取演示用户(JSON)',
  examplePostEcho: '发送 JSON 并回显',

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

  importedRequestsSummary: '已导入 {n} 个请求',
  skippedDuplicatesSummary: '，跳过 {n} 个重复项',
  loadedFileName: '已加载 {name}',

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
  responseTestsTab: '测试',

  // Misc placeholders
  paramName: '参数名',
  myApiRequest: '我的 API 请求',
  myApi: '我的 API',
  authPrefixExample: '例如 Token（Bearer 前缀），留空表示不加前缀',
  authBearerDefault: 'Bearer（默认）',
  deleteSelected: '删除所选（{n}）',
  deleteSelectedConfirm: '确定删除所选的 {n} 条历史记录吗？',
  copyPath: '复制路径',
  ratingPromptTitle: '用得还顺手吗？',
  ratingPromptContent: '如果 Pico API 对你有帮助，去 Chrome 应用商店打个分吧——能帮更多开发者发现它，只需 10 秒。',
  ratingPromptGo: '去评分',
  ratingPromptLater: '以后再说',

  // Request pipeline error messages (useRequestExecution)
  errUnsupportedProtocol: '{label}：不支持的协议 {protocol}——仅允许 http 和 https。',
  errEmptyHostname: '{label}：主机名为空。',
  errUrlParse: '{label}：{message}',
  errCouldNotParseUrl: '无法解析 URL',
  errUnresolvedVariables: '存在未解析的变量：{names}。请激活定义了 {names} 的环境，或将 {names} 添加到当前环境的变量中。（当前环境：{envName}。）',
  errNoEnvironment: '无环境',
  errInvalidRequest: '无效的请求：{message}',
  errCouldNotNormalize: '无法规范化',
  errInvalidUrl: '无效的 URL：{message}',
  errInvalidUrlHostname: '无效的 URL——主机名为空。',
  errCouldNotParse: '无法解析',
  errRequestFailed: '请求失败',
  errTimeout: '请求超时'
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
