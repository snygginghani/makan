"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Lang = "ar" | "en";

/* eslint-disable sort-keys */
const S = {
  // --- general / nav ---
  appName: { ar: "مكان", en: "Makan" },
  map: { ar: "الخريطة", en: "Map" },
  admin: { ar: "الإدارة", en: "Admin" },
  login: { ar: "تسجيل الدخول", en: "Sign in" },
  logout: { ar: "تسجيل الخروج", en: "Sign out" },
  myAccount: { ar: "حسابي", en: "My account" },
  suggestPlace: { ar: "اقترح مكان", en: "Suggest a place" },
  lightMode: { ar: "الوضع الفاتح", en: "Light mode" },
  darkMode: { ar: "الوضع الداكن", en: "Dark mode" },
  language: { ar: "English", en: "عربي" },
  switchLanguage: { ar: "التبديل إلى الإنجليزية", en: "Switch to Arabic" },
  loading: { ar: "يحمّل…", en: "Loading…" },
  save: { ar: "حفظ", en: "Save" },
  cancel: { ar: "إلغاء", en: "Cancel" },
  delete: { ar: "حذف", en: "Delete" },
  edit: { ar: "تعديل", en: "Edit" },
  close: { ar: "إغلاق", en: "Close" },
  error: { ar: "حدث خطأ", en: "Something went wrong" },
  km: { ar: "كم", en: "km" },

  // --- map page ---
  loadPlacesError: { ar: "تعذر تحميل الأماكن — تأكد أن الخادم يعمل", en: "Couldn't load places — is the server running?" },
  clearResults: { ar: "مسح النتائج", en: "Clear results" },
  askAboutPlace: { ar: "المساعد الذكي", en: "AI Assistant" },
  geoUnsupported: { ar: "المتصفح لا يدعم تحديد الموقع", en: "Your browser doesn't support geolocation" },
  geoDenied: { ar: "رفض المتصفح مشاركة الموقع — فعّل الإذن من إعدادات الموقع", en: "Location permission denied — enable it in site settings" },
  geoFailed: { ar: "تعذر الحصول على موقع دقيق، حاول مجدداً", en: "Couldn't get an accurate fix, try again" },
  geoSuccess: { ar: "تم تحديد موقعك (دقة ±{m} م)", en: "Location found (±{m} m accuracy)" },
  yourLocation: { ar: "موقعك", en: "Your location" },
  satellite: { ar: "قمر صناعي", en: "Satellite" },
  mapView: { ar: "خريطة", en: "Map" },
  all: { ar: "الكل", en: "All" },
  suggestedPlaces: { ar: "أماكن مقترحة", en: "Suggested places" },

  // --- chat ---
  chatTitle: { ar: "المساعد الذكي", en: "AI Assistant" },
  chatEmpty: { ar: "مرحباً! أنا مساعدك الذكي لاكتشاف الأردن. احكيلي شو بدك — مطل، كافيه، مسار، تخييم… ورح أقترح عليك أفضل الأماكن، وإذا فعّلت موقعك بقترح الأقرب لك.", en: "Hi! I'm your AI assistant for exploring Jordan. Tell me what you're after — a viewpoint, café, trail, camping… and I'll suggest the best spots, closest to you if you share your location." },
  chatEnableLocation: { ar: "فعّل موقعي ليقترح الأقرب لك", en: "Enable my location for nearby suggestions" },
  chatSearching: { ar: "المساعد يفكّر…", en: "Thinking…" },
  chatInputPlaceholder: { ar: "اكتب رسالتك…", en: "Type your message…" },
  chatSend: { ar: "إرسال", en: "Send" },
  chatError: { ar: "تعذر الاتصال بالمساعد الآن، حاول بعد قليل.", en: "Couldn't reach the assistant, try again shortly." },
  chatSuggestions: { ar: "أماكن مقترحة", en: "Suggested places" },
  openRoute: { ar: "افتح المسار في خرائط جوجل", en: "Open route in Google Maps" },
  chatLocationOn: { ar: "موقعك مُفعّل — أجاوبك حسب الأقرب لك", en: "Location on — I'll answer by what's nearest you" },
  chatLocationOff: { ar: "فعّل موقعك لإجابات حسب الأقرب لك", en: "Turn on location for nearest-to-you answers" },
  enableLocation: { ar: "تفعيل الموقع", en: "Enable location" },
  refreshLocation: { ar: "تحديث الموقع", en: "Refresh location" },
  locating: { ar: "جارٍ تحديد موقعك…", en: "Locating you…" },

  // --- place search ---
  searchPlaces: { ar: "ابحث عن مكان على الخريطة…", en: "Search places on the map…" },
  noPlacesFound: { ar: "لا توجد نتائج", en: "No matches" },

  // --- popup / cards ---
  details: { ar: "التفاصيل", en: "Details" },
  openInGoogleMaps: { ar: "افتح في خرائط جوجل", en: "Open in Google Maps" },
  directions: { ar: "الاتجاهات في خرائط جوجل", en: "Directions in Google Maps" },
  noReviewsYet: { ar: "لا توجد تعليقات بعد", en: "No reviews yet" },
  reviewsCount: { ar: "{n} تقييم", en: "{n} reviews" },

  // --- place detail ---
  about: { ar: "عن المكان", en: "About" },
  faq: { ar: "أسئلة شائعة", en: "FAQ" },
  verifiedCoords: { ar: "إحداثيات موثقة", en: "Verified coordinates" },
  approxCoords: { ar: "الموقع تقريبي", en: "Approximate location" },
  addFavorite: { ar: "أضف للمفضلة", en: "Add to favorites" },
  favorited: { ar: "مفضّل", en: "Favorited" },
  favoriteAdded: { ar: "انضاف لأماكنك المفضلة", en: "Added to your favorites" },
  loginFirst: { ar: "سجّل دخولك أولاً", en: "Sign in first" },
  reportPlace: { ar: "الإبلاغ عن معلومات خاطئة", en: "Report wrong information" },
  reportTitle: { ar: "الإبلاغ عن {name}", en: "Report {name}" },
  reportDescription: { ar: "معلومات غير دقيقة؟ مكان مغلق؟ خبّرنا وسيراجعه الفريق.", en: "Wrong info? Closed place? Tell us and the team will review it." },
  reportPlaceholder: { ar: "اكتب سبب البلاغ…", en: "Describe the issue…" },
  reportSend: { ar: "إرسال البلاغ", en: "Send report" },
  reportSent: { ar: "وصلنا بلاغك، شكراً لمساعدتك", en: "Report received, thanks for helping" },
  photoOf: { ar: "صورة من {name}", en: "Photo of {name}" },
  noCoords: { ar: "لم تُحدد إحداثيات هذا المكان بعد", en: "No coordinates set for this place yet" },

  // --- reviews ---
  reviews: { ar: "التقييمات والتعليقات", en: "Ratings & reviews" },
  writeReview: { ar: "قيّم المكان", en: "Rate this place" },
  yourRating: { ar: "تقييمك", en: "Your rating" },
  commentOptional: { ar: "تعليقك (اختياري)", en: "Your comment (optional)" },
  commentPlaceholder: { ar: "شاركنا تجربتك في المكان…", en: "Share your experience…" },
  submitReview: { ar: "نشر التقييم", en: "Post review" },
  reviewSaved: { ar: "تم حفظ تقييمك", en: "Your review was saved" },
  reviewDeleted: { ar: "حُذف تقييمك", en: "Your review was deleted" },
  deleteMyReview: { ar: "حذف تقييمي", en: "Delete my review" },
  loginToReview: { ar: "سجّل دخولك لتقييم المكان", en: "Sign in to review this place" },
  yourReviewTag: { ar: "تقييمك", en: "Your review" },

  // --- auth ---
  loginTitle: { ar: "أهلاً بك في مكان", en: "Welcome to Makan" },
  loginSubtitle: { ar: "سجّل دخولك بحساب جوجل للمتابعة", en: "Sign in with Google to continue" },
  sessionExpired: { ar: "انتهت جلستك — فضلاً سجّل الدخول من جديد", en: "Your session expired — please sign in again" },

  // --- onboarding ---
  onboardTitle: { ar: "أكمِل ملفك", en: "Complete your profile" },
  onboardSubtitle: { ar: "اختر اسم مستخدم لتبدأ المساهمة", en: "Pick a username to start contributing" },
  username: { ar: "اسم المستخدم", en: "Username" },
  usernameHint: { ar: "أحرف إنجليزية وأرقام و . _ فقط", en: "Letters, numbers, . and _ only" },
  homeRegion: { ar: "منطقتك (اختياري)", en: "Your region (optional)" },
  bio: { ar: "نبذة عنك (اختياري)", en: "Short bio (optional)" },
  finishOnboarding: { ar: "ابدأ الاستكشاف", en: "Start exploring" },
  usernameTaken: { ar: "اسم المستخدم مستخدم مسبقاً", en: "That username is taken" },

  // --- dashboard / gamification ---
  dashboard: { ar: "لوحتي", en: "My Dashboard" },
  leaderboard: { ar: "المتصدرون", en: "Leaderboard" },
  points: { ar: "نقطة", en: "points" },
  yourPoints: { ar: "نقاطك", en: "Your points" },
  yourRank: { ar: "ترتيبك", en: "Your rank" },
  level: { ar: "المستوى", en: "Level" },
  contributor: { ar: "مساهم", en: "Contributor" },
  contributors: { ar: "مساهم", en: "contributors" },
  toNextLevel: { ar: "{n} نقطة للمستوى التالي", en: "{n} pts to next level" },
  reviewsGiven: { ar: "تقييمات", en: "Reviews" },
  favoritesSaved: { ar: "مفضلة", en: "Favorites" },
  placesSuggested: { ar: "أماكن مقترحة", en: "Suggested" },
  placesApproved: { ar: "أماكن مقبولة", en: "Approved" },
  howToEarn: { ar: "كيف تكسب النقاط", en: "How to earn points" },
  earnReview: { ar: "قيّم أو علّق على مكان", en: "Rate or review a place" },
  earnSuggest: { ar: "اقترح مكاناً جديداً", en: "Suggest a new place" },
  earnApproved: { ar: "قبول اقتراحك (مكافأة)", en: "Your suggestion approved (bonus)" },
  leaderboardEmpty: { ar: "كن أول المساهمين!", en: "Be the first contributor!" },
  you: { ar: "أنت", en: "You" },
  noUsername: { ar: "بدون اسم", en: "no username" },
  of: { ar: "من", en: "of" },

  // --- admin: users ---
  usersSection: { ar: "المستخدمون", en: "Users" },
  searchUsers: { ar: "ابحث بالاسم أو البريد…", en: "Search name or email…" },
  user: { ar: "المستخدم", en: "User" },
  role: { ar: "الدور", en: "Role" },
  regionCol: { ar: "المنطقة", en: "Region" },
  joined: { ar: "انضم", en: "Joined" },
  admin_role: { ar: "مشرف", en: "Admin" },
  user_role: { ar: "مستخدم", en: "User" },
  makeAdmin: { ar: "ترقية لمشرف", en: "Make admin" },
  removeAdmin: { ar: "إزالة الإشراف", en: "Remove admin" },
  roleUpdated: { ar: "تم تحديث الدور", en: "Role updated" },
  roleUpdateFailed: { ar: "تعذر تحديث الدور", en: "Couldn't update role" },
  confirmMakeAdmin: { ar: "ترقية {name} إلى مشرف؟ سيتمكن من إدارة كل شيء.", en: "Promote {name} to admin? They'll be able to manage everything." },
  confirmRemoveAdmin: { ar: "إزالة صلاحيات الإشراف عن {name}؟", en: "Remove admin rights from {name}?" },
  loadUsersError: { ar: "تعذر تحميل المستخدمين", en: "Couldn't load users" },
  banUser: { ar: "حظر", en: "Ban" },
  unbanUser: { ar: "رفع الحظر", en: "Unban" },
  bannedBadge: { ar: "محظور", en: "Banned" },
  confirmBan: { ar: "حظر {name}؟ لن يتمكن من تسجيل الدخول أو استخدام الحساب.", en: "Ban {name}? They won't be able to sign in or use the account." },
  confirmBanIp: { ar: "احظر أيضاً عنوان IP الأخير له ({ip})؟ سيمنع جهازه بالكامل.", en: "Also ban their last IP ({ip})? This blocks their device entirely." },
  confirmUnban: { ar: "رفع الحظر عن {name}؟", en: "Lift the ban on {name}?" },
  userBanned: { ar: "تم حظر المستخدم", en: "User banned" },
  userUnbanned: { ar: "تم رفع الحظر", en: "Ban lifted" },
  banFailed: { ar: "تعذر تنفيذ الحظر", en: "Couldn't update ban" },
  locationCol: { ar: "الموقع", en: "Location" },
  viewLocation: { ar: "عرض على الخريطة", en: "View on map" },
  noLocation: { ar: "لم يُشارك", en: "Not shared" },

  // --- location picker ---
  location: { ar: "الموقع", en: "Location" },
  pickOnMap: { ar: "حدد على الخريطة", en: "Pick on map" },
  pasteGoogleLink: { ar: "رابط خرائط جوجل", en: "Google Maps link" },
  tapMapToSet: { ar: "ابحث أو اضغط على الخريطة لتحديد الموقع بدقة", en: "Search or tap the map to set the exact location" },
  searchAddressOrPlace: { ar: "ابحث عن عنوان أو مكان…", en: "Search an address or place…" },
  useMyLocation: { ar: "موقعي الحالي", en: "Use my location" },
  searchMapPlaces: { ar: "ابحث عن مكان على الخريطة…", en: "Search a place on the map…" },
  noMapResults: { ar: "لا نتائج مطابقة", en: "No matching results" },
  onTheMap: { ar: "على الخريطة", en: "On the map" },
  googleLinkPlaceholder: { ar: "الصق رابط الموقع من خرائط جوجل", en: "Paste the Google Maps link" },
  extractLocation: { ar: "استخراج الموقع", en: "Get location" },
  locationSet: { ar: "تم تحديد الموقع", en: "Location set" },
  linkResolveFailed: { ar: "تعذر قراءة الموقع من الرابط", en: "Couldn't read the location from that link" },
  clearLocation: { ar: "مسح", en: "Clear" },
  noLocationYet: { ar: "لم يُحدد موقع بعد", en: "No location set yet" },
  googleLinkHint: { ar: "افتح المكان في خرائط جوجل ← مشاركة ← نسخ الرابط", en: "Open the place in Google Maps → Share → Copy link" },
  signingIn: { ar: "جارٍ تسجيل الدخول…", en: "Signing you in…" },
  googleNotConfigured: {
    ar: "لم يُضبط تسجيل الدخول عبر جوجل بعد. أضف NEXT_PUBLIC_GOOGLE_CLIENT_ID في frontend/.env.local.",
    en: "Google Sign-In isn't configured yet. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in frontend/.env.local.",
  },
  loginPrivacy: {
    ar: "نستخدم حساب جوجل لتسجيل دخول آمن — لا نصل إلى كلمة مرورك.",
    en: "We use your Google account for secure sign-in — we never see your password.",
  },
  tabSignIn: { ar: "دخول", en: "Sign in" },
  tabSignUp: { ar: "حساب جديد", en: "Sign up" },
  orContinueWith: { ar: "أو تابع عبر", en: "or continue with" },
  continueEmail: { ar: "المتابعة بالبريد", en: "Continue with email" },
  verifyTitle: { ar: "تأكيد بريدك", en: "Verify your email" },
  verifySubtitle: {
    ar: "أرسلنا رمزاً مكوناً من 6 أرقام إلى {email}",
    en: "We sent a 6-digit code to {email}",
  },
  verifyCode: { ar: "رمز التحقق", en: "Verification code" },
  verifyButton: { ar: "تأكيد ودخول", en: "Verify & sign in" },
  resendCode: { ar: "إعادة إرسال الرمز", en: "Resend code" },
  codeResent: { ar: "أُرسل رمز جديد", en: "A new code was sent" },
  devCodeNotice: {
    ar: "وضع التطوير: رمزك هو {code}",
    en: "Dev mode: your code is {code}",
  },
  changeEmail: { ar: "تغيير البريد", en: "Change email" },
  verifyFailed: { ar: "رمز غير صحيح أو منتهي", en: "Wrong or expired code" },
  emailNotVerified: {
    ar: "لم يتم تأكيد بريدك بعد — تحقق من الرمز.",
    en: "Your email isn't verified yet — check your code.",
  },
  googleLanNote: {
    ar: "تسجيل جوجل يعمل عبر localhost فقط (جوجل لا يسمح بعناوين الشبكة المحلية).",
    en: "Google sign-in works on localhost only (Google disallows LAN IP origins).",
  },
  email: { ar: "البريد الإلكتروني", en: "Email" },
  password: { ar: "كلمة المرور", en: "Password" },
  passwordHint: { ar: "8 أحرف على الأقل", en: "At least 8 characters" },
  name: { ar: "الاسم", en: "Name" },
  signIn: { ar: "دخول", en: "Sign in" },
  createAccount: { ar: "إنشاء الحساب", en: "Create account" },
  newAccount: { ar: "حساب جديد", en: "New account" },
  noAccount: { ar: "ما عندك حساب؟", en: "No account?" },
  registerNow: { ar: "سجّل الآن", en: "Register now" },
  haveAccount: { ar: "عندك حساب؟", en: "Have an account?" },
  loginNow: { ar: "سجّل دخولك", en: "Sign in" },
  welcome: { ar: "أهلاً {name}!", en: "Welcome {name}!" },
  welcomeNew: { ar: "تم إنشاء حسابك — أهلاً بك في مكان!", en: "Account created — welcome to Makan!" },
  loginFailed: { ar: "تعذر تسجيل الدخول", en: "Sign-in failed" },
  registerFailed: { ar: "تعذر إنشاء الحساب", en: "Couldn't create the account" },

  // --- suggest a place ---
  suggestTitle: { ar: "اقترح مكاناً جديداً", en: "Suggest a new place" },
  suggestIntro: { ar: "تعرف مكاناً يستحق الظهور على الخريطة؟ عبّي البيانات وسيراجعه فريقنا.", en: "Know a spot that belongs on the map? Fill in the details and our team will review it." },
  suggestSubmit: { ar: "إرسال المقترح", en: "Submit suggestion" },
  suggestSubmitted: { ar: "وصل مقترحك! سيظهر على الخريطة بعد موافقة الإدارة.", en: "Suggestion received! It will appear once approved." },
  suggestLoginRequired: { ar: "سجّل دخولك لاقتراح مكان", en: "Sign in to suggest a place" },
  photos: { ar: "الصور", en: "Photos" },
  photoRequired: { ar: "صورة واحدة على الأقل مطلوبة", en: "At least one photo is required" },
  addPhotos: { ar: "إضافة صور", en: "Add photos" },
  photoUploadFailed: { ar: "تعذر رفع الصور", en: "Photo upload failed" },
  mySubmissions: { ar: "مقترحاتي", en: "My suggestions" },

  // --- forms ---
  nameAr: { ar: "الاسم بالعربية", en: "Name (Arabic)" },
  nameEn: { ar: "الاسم بالإنجليزية", en: "Name (English)" },
  description: { ar: "الوصف", en: "Description" },
  category: { ar: "التصنيف", en: "Category" },
  region: { ar: "المنطقة", en: "Region" },
  regionPlaceholder: { ar: "عمان، عجلون…", en: "Amman, Ajloun…" },
  latitude: { ar: "خط العرض (lat)", en: "Latitude" },
  longitude: { ar: "خط الطول (lng)", en: "Longitude" },
  tags: { ar: "الوسوم (مفصولة بفواصل)", en: "Tags (comma separated)" },
  tagsPlaceholder: { ar: "غروب, تصوير, عائلات", en: "sunset, photography, families" },
  coordsVerified: { ar: "الإحداثيات موثقة ميدانياً", en: "Coordinates field-verified" },

  // --- admin ---
  adminPanel: { ar: "لوحة الإدارة", en: "Admin Panel" },
  overview: { ar: "نظرة عامة", en: "Overview" },
  placesSection: { ar: "الأماكن", en: "Places" },
  submissionsSection: { ar: "المقترحات", en: "Suggestions" },
  reportsSection: { ar: "البلاغات", en: "Reports" },
  categoriesSection: { ar: "التصنيفات", en: "Categories" },
  adminOnly: { ar: "هذه الصفحة للمشرفين فقط", en: "Admins only" },
  adminOnlyHint: { ar: "سجّل دخولك بحساب مشرف للوصول إلى لوحة الإدارة.", en: "Sign in with an admin account to access this panel." },
  publishedPlaces: { ar: "الأماكن المنشورة", en: "Published places" },
  ofTotal: { ar: "من أصل {n}", en: "of {n} total" },
  users: { ar: "المستخدمون", en: "Users" },
  registeredAccount: { ar: "حساب مسجل", en: "registered accounts" },
  indexedPlaces: { ar: "أماكن مفهرسة للذكاء", en: "AI-indexed places" },
  knowledgeChunks: { ar: "{n} مقطع معرفة", en: "{n} knowledge chunks" },
  pendingSubmissions: { ar: "مقترحات معلقة", en: "Pending suggestions" },
  awaitingReview: { ar: "بانتظار المراجعة", en: "awaiting review" },
  openReports: { ar: "بلاغات مفتوحة", en: "Open reports" },
  needsAction: { ar: "تحتاج معالجة", en: "need action" },
  placesByCategory: { ar: "الأماكن حسب التصنيف", en: "Places by category" },
  newPlace: { ar: "مكان جديد", en: "New place" },
  searchByName: { ar: "ابحث بالاسم…", en: "Search by name…" },
  place: { ar: "المكان", en: "Place" },
  status: { ar: "الحالة", en: "Status" },
  actions: { ar: "إجراءات", en: "Actions" },
  published: { ar: "منشور", en: "Published" },
  draft: { ar: "مسودة", en: "Draft" },
  managePhotos: { ar: "إدارة الصور", en: "Manage photos" },
  uploadKnowledge: { ar: "رفع ملف معرفة JSON", en: "Upload knowledge JSON" },
  reindexKnowledge: { ar: "إعادة توليد المتجهات", en: "Rebuild embeddings" },
  deleteConfirmPlace: { ar: "حذف \"{name}\" نهائياً؟ سيُحذف معه ملف المعرفة والفهرسة.", en: "Permanently delete \"{name}\"? Its knowledge file and index will be removed too." },
  deleted: { ar: "تم الحذف", en: "Deleted" },
  deleteFailed: { ar: "تعذر الحذف", en: "Delete failed" },
  saveFailed: { ar: "تعذر الحفظ", en: "Save failed" },
  placeSaved: { ar: "تم تحديث المكان", en: "Place updated" },
  placeCreated: { ar: "تمت إضافة المكان", en: "Place created" },
  editPlace: { ar: "تعديل {name}", en: "Edit {name}" },
  newPlaceHint: { ar: "أدخل بيانات المكان — يُنشر فوراً بعد الإضافة.", en: "Enter the place details — it publishes immediately." },
  editPlaceHint: { ar: "عدّل بيانات المكان ثم احفظ.", en: "Edit the details, then save." },
  photosDialogHint: { ar: "JPG / PNG / WebP حتى 8MB للصورة — الصورة الأولى تظهر على البطاقة.", en: "JPG / PNG / WebP up to 8MB each — the first photo shows on the card." },
  noPhotosYet: { ar: "لا توجد صور بعد", en: "No photos yet" },
  photosAdded: { ar: "أُضيفت {n} صورة", en: "{n} photos added" },
  photoDeleted: { ar: "حُذفت الصورة", en: "Photo deleted" },
  photoDeleteFailed: { ar: "تعذر حذف الصورة", en: "Couldn't delete the photo" },
  chunksIndexed: { ar: "تمت الفهرسة: {n} مقطع معرفة", en: "Indexed: {n} knowledge chunks" },
  reindexed: { ar: "أُعيدت فهرسة {n} مقطع", en: "Re-indexed {n} chunks" },
  noKnowledgeFile: { ar: "لا يوجد ملف معرفة لهذا المكان", en: "No knowledge file for this place" },
  knowledgeUploadFailed: { ar: "تعذر رفع الملف", en: "Upload failed" },
  loadSubmissionsError: { ar: "تعذر تحميل المقترحات", en: "Couldn't load suggestions" },
  noSubmissions: { ar: "لا توجد مقترحات من المستخدمين بعد", en: "No user suggestions yet" },
  pending: { ar: "معلق", en: "Pending" },
  approved: { ar: "مقبول", en: "Approved" },
  rejected: { ar: "مرفوض", en: "Rejected" },
  approveAndPublish: { ar: "قبول ونشر", en: "Approve & publish" },
  reject: { ar: "رفض", en: "Reject" },
  approvedToast: { ar: "قُبل المقترح وأُنشئ المكان", en: "Approved — place created" },
  rejectedToast: { ar: "رُفض المقترح", en: "Suggestion rejected" },
  reviewFailed: { ar: "تعذرت المراجعة", en: "Review failed" },
  rejectReason: { ar: "سبب الرفض", en: "Rejection reason" },
  rejectReasonPlaceholder: { ar: "السبب يظهر للمستخدم صاحب المقترح…", en: "Shown to the user who suggested it…" },
  confirmReject: { ar: "تأكيد الرفض", en: "Confirm rejection" },
  reviewNote: { ar: "ملاحظة المراجعة: {note}", en: "Review note: {note}" },
  loadReportsError: { ar: "تعذر تحميل البلاغات", en: "Couldn't load reports" },
  noReports: { ar: "لا توجد بلاغات — كل شيء تمام", en: "No reports — all clear" },
  resolved: { ar: "معالج", en: "Resolved" },
  open: { ar: "مفتوح", en: "Open" },
  markResolved: { ar: "تمت المعالجة", en: "Mark resolved" },
  reportResolved: { ar: "عولج البلاغ", en: "Report resolved" },
  resolveFailed: { ar: "تعذرت المعالجة", en: "Couldn't resolve" },
  placeRef: { ar: "المكان #{id}", en: "Place #{id}" },
  newCategory: { ar: "تصنيف جديد", en: "New category" },
  categorySlug: { ar: "المعرف (إنجليزي)", en: "Slug (english)" },
  categoryIcon: { ar: "الأيقونة", en: "Icon" },
  categoryColor: { ar: "اللون", en: "Color" },
  categoryAdded: { ar: "أُضيف التصنيف", en: "Category added" },
  categoryUpdated: { ar: "حُدّث التصنيف", en: "Category updated" },
  categoryUpdateFailed: { ar: "تعذر التحديث", en: "Couldn't update category" },
  editCategory: { ar: "تعديل التصنيف", en: "Edit category" },
  categoryDeleted: { ar: "حُذف التصنيف", en: "Category deleted" },
  categoryDeleteFailed: { ar: "تعذر الحذف — التصنيف مستخدم", en: "Delete failed — category is in use" },
  categoryAddFailed: { ar: "تعذرت الإضافة", en: "Couldn't add category" },
  loadCategoriesError: { ar: "تعذر تحميل التصنيفات", en: "Couldn't load categories" },
} as const;
/* eslint-enable sort-keys */

export type StrKey = keyof typeof S;

export const QUICK_PROMPTS: Record<Lang, string[]> = {
  ar: [
    "وين أقرب مطل حلو إلي؟",
    "رتّبلي طلعة حلوة اليوم",
    "كافيه هادي للدراسة بعمّان",
    "مكان تخييم نشوف فيه النجوم",
  ],
  en: [
    "Nearest nice viewpoint to me?",
    "Plan me a fun hangout today",
    "Quiet café to study in Amman",
    "Camping spot for stargazing",
  ],
};

interface LangContextValue {
  lang: Lang;
  dir: "rtl" | "ltr";
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: (key: StrKey, vars?: Record<string, string | number>) => string;
}

const LangContext = createContext<LangContextValue | null>(null);

function applyToDocument(lang: Lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("makan_lang");
      if (stored === "en" || stored === "ar") {
        setLangState(stored);
        applyToDocument(stored);
      }
    } catch {
      /* private mode */
    }
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    applyToDocument(next);
    try {
      localStorage.setItem("makan_lang", next);
    } catch {
      /* private mode */
    }
  }, []);

  const toggleLang = useCallback(
    () => setLang(lang === "ar" ? "en" : "ar"),
    [lang, setLang],
  );

  const t = useCallback(
    (key: StrKey, vars?: Record<string, string | number>) => {
      let text: string = S[key][lang];
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.replaceAll(`{${name}}`, String(value));
        }
      }
      return text;
    },
    [lang],
  );

  return (
    <LangContext.Provider
      value={{ lang, dir: lang === "ar" ? "rtl" : "ltr", setLang, toggleLang, t }}
    >
      {children}
    </LangContext.Provider>
  );
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside LangProvider");
  return ctx;
}

export function placeName(
  place: { name_ar: string; name_en: string },
  lang: Lang,
): string {
  return lang === "ar" ? place.name_ar : place.name_en;
}

export function placeAltName(
  place: { name_ar: string; name_en: string },
  lang: Lang,
): string {
  return lang === "ar" ? place.name_en : place.name_ar;
}
