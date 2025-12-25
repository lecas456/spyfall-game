const { createClient } = require('@supabase/supabase-js');

// Substitua pelos seus dados do Supabase
const supabaseUrl = 'https://trwjggwzaxoatxpfitjg.supabase.co';
const supabaseKey = 'sb_publishable_kh-Cvqs5hHDTuxrD2hUI1w_8Yj23ggi';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;