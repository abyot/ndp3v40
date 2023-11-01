alter table dataelement add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table dataset add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table userinfo add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table usergroup add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table maplegendset add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table optionvalue add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table optionset add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table programindicator add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table sqlview add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table constant add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table document add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table indicator add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table indicatorgroup add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table dataelementgroupset add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table dataelementgroup add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table orgunitgroupset add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table orgunitgroup add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table organisationunit add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table categoryoptioncombo add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table validationrule add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table validationrulegroup add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table categoryoptiongroupset add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table dataelementcategoryoption add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table categoryoptiongroup add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table dataelementcategory add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table program add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table programstage add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table trackedentityattribute add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table trackedentitytype add column if not exists attributevalues jsonb default '{}'::jsonb;
alter table section add column if not exists attributevalues jsonb default '{}'::jsonb;