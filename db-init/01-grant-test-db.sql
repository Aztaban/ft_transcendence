-- hardcoded: init scripts can't read .env, must match MYSQL_USER in .env.example
GRANT ALL PRIVILEGES ON `test_%`.* TO 'transcendence'@'%';
FLUSH PRIVILEGES;
