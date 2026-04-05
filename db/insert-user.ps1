docker exec -it infp-mysql mysql -u root -p infp `
-e "INSERT INTO users (email, password, role) VALUES ('test@infp.com', '$2a$10$l1ClyZR1YOzGu3te.s2OSOKCQZVq32n6xM0Uq0hkWvOb490Ge6doS', 'USER');"