CREATE DATABASE IF NOT EXISTS facial
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE facial;

CREATE TABLE IF NOT EXISTS admins (
  id          INT UNSIGNED               NOT NULL AUTO_INCREMENT,
  full_name   VARCHAR(150)               NOT NULL,
  email       VARCHAR(255)               NOT NULL UNIQUE,
  phone       VARCHAR(20)                         DEFAULT NULL,
  password    VARCHAR(255)               NOT NULL,
  role        ENUM('admin','superadmin') NOT NULL DEFAULT 'admin',
  created_at  TIMESTAMP                  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_admins_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS classes (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100)  NOT NULL UNIQUE,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_classes_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS students (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  student_id     VARCHAR(50)   NOT NULL UNIQUE,
  name           VARCHAR(150)  NOT NULL,
  class_id       INT UNSIGNED           DEFAULT NULL,
  face_enrolled  TINYINT(1)    NOT NULL DEFAULT 0,
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_students_student_id (student_id),
  INDEX idx_students_class_id   (class_id),

  CONSTRAINT fk_students_class
    FOREIGN KEY (class_id) REFERENCES classes (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS attendance (
  id               INT UNSIGNED                    NOT NULL AUTO_INCREMENT,
  student_id       VARCHAR(50)                     NOT NULL,
  class_id         INT UNSIGNED                              DEFAULT NULL,
  status           ENUM('present','absent','late') NOT NULL DEFAULT 'present',
  attendance_date  DATE                            NOT NULL DEFAULT (CURDATE()),
  created_at       TIMESTAMP                       NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_attendance_student_day (student_id, attendance_date),
  INDEX idx_attendance_class_id (class_id),
  INDEX idx_attendance_date     (attendance_date),

  CONSTRAINT fk_attendance_class
    FOREIGN KEY (class_id) REFERENCES classes (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS settings (
  id                 INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  school_name        VARCHAR(200)  NOT NULL DEFAULT 'My School',
  default_session    VARCHAR(100)           DEFAULT NULL,
  cutoff_time        TIME                   DEFAULT '09:00:00',
  allow_late_marking TINYINT(1)    NOT NULL DEFAULT 1,

  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO settings (id, school_name, default_session, cutoff_time, allow_late_marking)
VALUES (1, 'My School', '2025/2026', '09:00:00', 1);
