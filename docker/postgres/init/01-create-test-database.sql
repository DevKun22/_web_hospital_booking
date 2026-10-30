SELECT 'CREATE DATABASE hospital_booking_test'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'hospital_booking_test'
)\gexec
