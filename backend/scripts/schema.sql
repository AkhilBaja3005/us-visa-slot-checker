-- SQL Migration script to initialize the tables in Supabase for US Visa Slot Checker

-- 1. Create the configuration table
CREATE TABLE IF NOT EXISTS us_visa_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT single_row CHECK (id = 1)
);

-- Enable Row Level Security (RLS) if desired, or leave open for simple client-side access.
-- Standard recommendation: Allow access based on API key permissions.
ALTER TABLE us_visa_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access" ON us_visa_config
    FOR SELECT USING (true);

CREATE POLICY "Allow anonymous upsert access" ON us_visa_config
    FOR ALL USING (true) WITH CHECK (true);


-- 2. Create the history log table
CREATE TABLE IF NOT EXISTS us_visa_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    engine TEXT NOT NULL,
    status TEXT NOT NULL,
    slots JSONB NOT NULL
);

-- Enable RLS for history table
ALTER TABLE us_visa_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access" ON us_visa_history
    FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert access" ON us_visa_history
    FOR INSERT WITH CHECK (true);
