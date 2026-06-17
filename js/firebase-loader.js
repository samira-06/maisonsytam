// Firebase Loader — initialise Firebase si configuré
// Charge Firestore, Auth et Storage

const FirebaseApp = {
  db: null,
  auth: null,
  storage: null,
  ready: false,
};

(function () {
  if (!FIREBASE_READY) {
    console.warn('⚠ Firebase non configuré. Utilisation du stockage local (localStorage).');
    return;
  }

  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    FirebaseApp.db = firebase.firestore();
    FirebaseApp.auth = firebase.auth();
    FirebaseApp.storage = firebase.storage();
    FirebaseApp.ready = true;
    console.log('✓ Firebase initialisé');
  } catch (e) {
    console.error('Erreur Firebase:', e);
  }
})();
