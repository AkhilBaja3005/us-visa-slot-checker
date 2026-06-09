// Script to test Supabase connection and verify tables exist
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Error: SUPABASE_URL and SUPABASE_KEY must be set in your environment or backend/.env file.");
  process.exit(1);
}

console.log("Connecting to Supabase at:", supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    console.log("Checking if 'us_visa_config' table exists and is accessible...");
    const { data: configData, error: configError } = await supabase
      .from('us_visa_config')
      .select('id')
      .limit(1);

    if (configError) {
      if (configError.code === 'PGRST116' || configError.message.includes("does not exist")) {
        console.error("❌ Error: Table 'us_visa_config' was not found or is not accessible.");
        console.error("Please run the SQL schema in your Supabase SQL Editor first. Script: backend/scripts/schema.sql");
      } else {
        console.error("❌ Supabase API error:", configError.message);
      }
      return;
    }

    console.log("✅ Table 'us_visa_config' is accessible.");

    console.log("Checking if 'us_visa_history' table exists and is accessible...");
    const { data: historyData, error: historyError } = await supabase
      .from('us_visa_history')
      .select('id')
      .limit(1);

    if (historyError) {
      if (historyError.code === 'PGRST116' || historyError.message.includes("does not exist")) {
        console.error("❌ Error: Table 'us_visa_history' was not found or is not accessible.");
        console.error("Please run the SQL schema in your Supabase SQL Editor first. Script: backend/scripts/schema.sql");
      } else {
        console.error("❌ Supabase API error:", historyError.message);
      }
      return;
    }

    console.log("✅ Table 'us_visa_history' is accessible.");
    console.log("🎉 Supabase connection and tables are fully verified and ready!");

  } catch (err) {
    console.error("❌ Unexpected error testing connection:", err.message);
  }
}

testConnection();
