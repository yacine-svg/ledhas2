/* Ledhas · configuration partagée par le site et l'espace de gestion.
   Ces deux valeurs viennent de Supabase → Project Settings → API.
   La clé « anon / publishable » est faite pour être publique : les données
   restent protégées par les règles de sécurité (RLS) de supabase/schema.sql.
   Tant qu'elles sont vides, le formulaire du site continue de fonctionner
   (ouverture de WhatsApp) mais n'enregistre rien. */
window.LEDHAS_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  whatsappNumber: "213550581196"
};
