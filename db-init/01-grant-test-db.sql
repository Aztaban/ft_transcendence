-- Runs only on first initialisation of an empty data directory.
-- Lets the app user create Django's throwaway test_<db> database.
-- Hardcoded: init scripts can't read .env, must match MYSQL_USER in .env.example
GRANT ALL PRIVILEGES ON `test_%`.* TO 'transcendence'@'%';
FLUSH PRIVILEGES;
