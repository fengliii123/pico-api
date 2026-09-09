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
  errRequestFailed: string
  errTimeout: string
}
