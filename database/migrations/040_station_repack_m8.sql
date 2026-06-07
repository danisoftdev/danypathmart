-- Phase M8: station staff repack at pickup stations

ALTER TABLE users
    MODIFY COLUMN role ENUM('super_admin','staff','customer','driver','station_staff') NOT NULL DEFAULT 'customer';

ALTER TABLE users
    ADD COLUMN assigned_pickup_station_id BIGINT UNSIGNED DEFAULT NULL AFTER phone;

ALTER TABLE users
    ADD CONSTRAINT fk_users_assigned_station FOREIGN KEY (assigned_pickup_station_id)
        REFERENCES pickup_stations (id) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS station_repack_logs (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id            BIGINT UNSIGNED NOT NULL,
    pickup_station_id   BIGINT UNSIGNED NOT NULL,
    staff_user_id       BIGINT UNSIGNED NOT NULL,
    event_type          ENUM('repack_completed','collected') NOT NULL,
    bag_label           VARCHAR(80)     DEFAULT NULL,
    note                VARCHAR(500)    DEFAULT NULL,
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_station_repack_logs_order (order_id, event_type),
    KEY idx_station_repack_logs_station (pickup_station_id, created_at),
    CONSTRAINT fk_station_repack_logs_order FOREIGN KEY (order_id)
        REFERENCES orders (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_station_repack_logs_station FOREIGN KEY (pickup_station_id)
        REFERENCES pickup_stations (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_station_repack_logs_staff FOREIGN KEY (staff_user_id)
        REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
