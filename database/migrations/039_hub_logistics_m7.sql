-- Phase M7: hub logistics, delivery runs, driver role

ALTER TABLE users
    MODIFY COLUMN role ENUM('super_admin','staff','customer','driver') NOT NULL DEFAULT 'customer';

ALTER TABLE orders
    MODIFY COLUMN status ENUM(
        'placed','payment_confirmed','pending','processing',
        'received_at_hub','shipped','out_for_delivery','delivered',
        'sent_to_station','ready_for_pickup','collected','cancelled'
    ) NOT NULL DEFAULT 'placed';

ALTER TABLE order_tracking
    MODIFY COLUMN status ENUM(
        'placed','payment_confirmed','pending','processing',
        'received_at_hub','shipped','out_for_delivery','delivered',
        'sent_to_station','ready_for_pickup','collected','cancelled'
    ) NOT NULL DEFAULT 'placed';

CREATE TABLE IF NOT EXISTS delivery_runs (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    driver_user_id  BIGINT UNSIGNED NOT NULL,
    status          ENUM('draft','dispatched','completed','cancelled') NOT NULL DEFAULT 'draft',
    title           VARCHAR(120)    DEFAULT NULL,
    hub_note        TEXT            DEFAULT NULL,
    created_by      BIGINT UNSIGNED DEFAULT NULL,
    dispatched_at   TIMESTAMP       NULL DEFAULT NULL,
    completed_at    TIMESTAMP       NULL DEFAULT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_delivery_runs_driver (driver_user_id, status),
    KEY idx_delivery_runs_status (status),
    CONSTRAINT fk_delivery_runs_driver FOREIGN KEY (driver_user_id)
        REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_delivery_runs_creator FOREIGN KEY (created_by)
        REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS delivery_run_stops (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    run_id              BIGINT UNSIGNED NOT NULL,
    order_id            BIGINT UNSIGNED NOT NULL,
    pickup_station_id   BIGINT UNSIGNED NOT NULL,
    stop_order          INT UNSIGNED    NOT NULL DEFAULT 1,
    status              ENUM('pending','delivered') NOT NULL DEFAULT 'pending',
    delivered_at        TIMESTAMP       NULL DEFAULT NULL,
    delivery_note       VARCHAR(500)    DEFAULT NULL,
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_delivery_run_stops_order (order_id),
    KEY idx_delivery_run_stops_run (run_id, stop_order),
    CONSTRAINT fk_delivery_run_stops_run FOREIGN KEY (run_id)
        REFERENCES delivery_runs (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_delivery_run_stops_order FOREIGN KEY (order_id)
        REFERENCES orders (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_delivery_run_stops_station FOREIGN KEY (pickup_station_id)
        REFERENCES pickup_stations (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
