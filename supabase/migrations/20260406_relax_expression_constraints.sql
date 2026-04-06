-- country and abv were originally NOT NULL but AI intake cannot always
-- detect them from label photos. Make them nullable so saves succeed
-- when these fields are missing.
alter table if exists expressions
  alter column country drop not null,
  alter column abv drop not null;
