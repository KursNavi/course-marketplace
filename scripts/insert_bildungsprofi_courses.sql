-- =====================================================
-- Bildungsprofi - 19 Kurse (Berufsbildung & Weiterbildung)
-- Provider UUID: 474940af-bca6-4833-99fc-d6a79261ec6c
-- =====================================================

-- Kurs 1: Berufsbildner-Kurs ALLE Berufsgruppen gemischt
INSERT INTO courses (
    user_id,
    title,
    description,
    keywords,
    objectives,
    prerequisites,
    price,
    level,
    languages,
    delivery_types,
    category_type,
    category_area,
    category_specialty,
    category_focus,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro,
    canton,
    address
) VALUES (
    '474940af-bca6-4833-99fc-d6a79261ec6c'::uuid,
    'Berufsbildner-Kurs ALLE Berufsgruppen gemischt',
    'Dieser Berufsbildner-Kurs richtet sich an Berufsbildnerinnen und Berufsbildner aus unterschiedlichen Branchen, die Lernende im Betrieb ausbilden oder sich auf diese Aufgabe vorbereiten. Der Kurs ist so aufgebaut, dass zentrale Grundlagen der beruflichen Grundbildung für gemischte Gruppen verständlich und direkt anwendbar vermittelt werden.

Im Fokus stehen die Rolle als Berufsbildner/in, die zielorientierte Planung der Ausbildung im Betrieb sowie der sichere Umgang mit typischen Ausbildungssituationen im Alltag. Zusätzlich werden Aspekte der Zusammenarbeit zwischen Betrieb und den weiteren Lernorten berücksichtigt, damit die praktische Ausbildung konsistent und nachvollziehbar gestaltet werden kann.

Nach vollständigem Besuch wird der kantonale Kursausweis abgegeben, der eidgenössisch gültig ist. Die Durchführung erfolgt im Kanton Zürich in Partnerschaft mit der Berufsschule Bülach.',
    'Berufsbildnerkurs, Berufsbildung, Lernende ausbilden, Ausbildungsplanung, Praxisanleitung, Lehrbetrieb, Ausbildungsgespräche, Ausbildungsqualität, Kursausweis, Bülach, gemischte Berufsgruppen',
    ARRAY[
        'Rolle und Verantwortung als Berufsbildner/in im Betrieb klären',
        'Praktische Ausbildung strukturiert planen und begleiten',
        'Ausbildungssituationen im Alltag sicher gestalten',
        'Zusammenarbeit mit weiteren Lernorten sinnvoll koordinieren'
    ],
    'Keine formalen Voraussetzungen',
    510.00,
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'bildung_pruefung',
    'Ausbilder / SVEB',
    NULL,
    40,
    NULL,
    'https://www.bildungsprofi.ch/berufs-und-praxisbildner/kurse/alle-kurse/?tx_kursadmin_kursliste%5Bkurs%5D=35&tx_kursadmin_kursliste%5Baction%5D=show&tx_kursadmin_kursliste%5Bcontroller%5D=Kurs&cHash=3eddb389f4f1be7e82ed6468166bcbdb',
    'lead',
    'draft',
    true,
    'Zürich',
    NULL
) RETURNING id;

-- Kurs 2: Berufsbildner-Kurs Dentalassistentinnen (SVDA)
INSERT INTO courses (
    user_id,
    title,
    description,
    keywords,
    objectives,
    prerequisites,
    price,
    level,
    languages,
    delivery_types,
    category_type,
    category_area,
    category_specialty,
    category_focus,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro,
    canton,
    address
) VALUES (
    '474940af-bca6-4833-99fc-d6a79261ec6c'::uuid,
    'Berufsbildner-Kurs Dentalassistentinnen (SVDA)',
    'Dieser Berufsbildner-Kurs ist auf die praktische Ausbildung von Dentalassistentinnen und Dentalassistenten ausgerichtet und dient der Qualifizierung von Personen, die Lernende in der Zahnarztpraxis begleiten. Der Kurs greift die Anforderungen der Berufsbildung auf und unterstützt dabei, die Ausbildung im Betrieb systematisch zu planen und im Alltag umzusetzen.

Ein Schwerpunkt liegt auf der Abstimmung zwischen den Lernorten Betrieb, Schule und überbetrieblichen Kursen, damit Lerninhalte nachvollziehbar aufgebaut und begleitet werden können. Zudem werden aktuelle Rahmenbedingungen berücksichtigt, die sich mit überarbeiteten Vorgaben und Bildungsplänen in der Ausbildung ergeben haben.

Nach vollständigem Besuch wird der kantonale Kursausweis abgegeben, der eidgenössisch gültig ist. Die Durchführung erfolgt in Kooperation mit dem SVDA, mit Angeboten in den Kantonen Zürich und Bern.',
    'Dentalassistenz, Berufsbildnerkurs, SVDA, Lernende ausbilden, Bildungsplan, BiVo, ÜK, Praxisanleitung, Lehrbetrieb Zahnarztpraxis, Ausbildungsgespräche, Handlungskompetenzen, Kursausweis',
    ARRAY[
        'Praktische Ausbildung im Lehrbetrieb zielorientiert strukturieren',
        'Zusammenarbeit zwischen Betrieb, Schule und ÜK wirksam unterstützen',
        'Handlungskompetenzorientierte Ausbildungslogik in der Praxis anwenden',
        'Ausbildungsaufgaben und Zeitmanagement im Betrieb klären'
    ],
    'Keine formalen Voraussetzungen',
    790.00,
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'bildung_pruefung',
    'Ausbilder / SVEB',
    NULL,
    40,
    NULL,
    'https://www.bildungsprofi.ch/berufs-und-praxisbildner/kurse/alle-kurse/?tx_kursadmin_kursliste%5Bkurs%5D=3&tx_kursadmin_kursliste%5Baction%5D=show&tx_kursadmin_kursliste%5Bcontroller%5D=Kurs&cHash=242628604fe9f843fe68c1df11260c08',
    'lead',
    'draft',
    true,
    NULL,
    NULL
) RETURNING id;

-- Kurs 3: Berufsbildner-Kurs Fachpersonen Betreuung (FaBe)
INSERT INTO courses (
    user_id,
    title,
    description,
    keywords,
    objectives,
    prerequisites,
    price,
    level,
    languages,
    delivery_types,
    category_type,
    category_area,
    category_specialty,
    category_focus,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro,
    canton,
    address
) VALUES (
    '474940af-bca6-4833-99fc-d6a79261ec6c'::uuid,
    'Berufsbildner-Kurs Fachpersonen Betreuung (FaBe)',
    'Dieser Berufsbildner-Kurs richtet sich an Berufsbildnerinnen und Berufsbildner im Bereich Betreuung und sozialer Berufe. Er unterstützt dabei, die praktische Ausbildung von Lernenden im Betrieb professionell zu organisieren und die eigene Rolle als Ausbildungsverantwortliche/r zu klären.

Der Kurs ist als Qualifizierung gemäss Berufsbildungsgesetz eingeordnet und zielt darauf ab, die Ausbildung im Betrieb nachvollziehbar zu planen, Lernfortschritte zu begleiten und typische Ausbildungssituationen sicher zu gestalten.

Nach vollständigem Besuch wird der kantonale Kursausweis abgegeben, der eidgenössisch gültig ist. Angeboten wird der Kurs in Kooperation mit dem BBSZ Brugg; die Durchführung ist u.a. am Standort Schönbühl SH ausgeschrieben.',
    'Fachpersonen Betreuung, FaBe, Berufsbildnerkurs, Praxisanleitung, Lernende begleiten, Ausbildungsplanung, Berufliche Grundbildung, Kursausweis, Schönbühl, BBSZ Brugg, Ausbildungsqualität, Betreuungsberufe',
    ARRAY[
        'Rolle als Berufsbildner/in im Betreuungsbereich sicher wahrnehmen',
        'Praktische Ausbildung im Betrieb strukturiert planen',
        'Lernende gezielt begleiten und Ausbildungsfortschritte sichern',
        'Ausbildungssituationen im Alltag reflektiert steuern'
    ],
    'Keine formalen Voraussetzungen',
    530.00,
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'bildung_pruefung',
    'Ausbilder / SVEB',
    NULL,
    40,
    NULL,
    'https://www.bildungsprofi.ch/berufs-und-praxisbildner/kurse/alle-kurse/?tx_kursadmin_kursliste%5Bkurs%5D=41&tx_kursadmin_kursliste%5Baction%5D=show&tx_kursadmin_kursliste%5Bcontroller%5D=Kurs&cHash=b1921f69b9f57740befe928ad0b041e0',
    'lead',
    'draft',
    true,
    'Schaffhausen',
    NULL
) RETURNING id;

-- Kurs 4: Berufsbildner-Kurs Gastro-Berufe
INSERT INTO courses (
    user_id,
    title,
    description,
    keywords,
    objectives,
    prerequisites,
    price,
    level,
    languages,
    delivery_types,
    category_type,
    category_area,
    category_specialty,
    category_focus,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro,
    canton,
    address
) VALUES (
    '474940af-bca6-4833-99fc-d6a79261ec6c'::uuid,
    'Berufsbildner-Kurs Gastro-Berufe',
    'Dieser Berufsbildner-Kurs ist auf Gastro-Berufe ausgerichtet und dient der Qualifizierung von Berufsbildnerinnen und Berufsbildnern, die Lernende im Gastgewerbe ausbilden. Die Durchführung ist im Kanton Aargau in Partnerschaft mit GastroAargau vorgesehen und findet in deren Örtlichkeiten statt.

Der Kurs ist so eingeordnet, dass die Anforderungen der kantonalen und eidgenössischen Gesetzgebung erfüllt werden. Nach vollständigem Besuch wird der kantonale Ausweis abgegeben, der eidgenössisch gültig ist.

Inhaltlich steht die sichere Gestaltung der praktischen Ausbildung im Betrieb im Mittelpunkt: Ausbildungsaufgaben werden strukturiert, Verantwortlichkeiten geklärt und der Ausbildungsalltag so organisiert, dass Lernende nachvollziehbar angeleitet und begleitet werden können. Der Kurs ist eduQua-zertifiziert.',
    'Gastro, Gastgewerbe, Berufsbildnerkurs, Lehrmeisterkurs, Lernende ausbilden, Praxisanleitung, Kursausweis, Aargau, GastroAargau, Ausbildungsplanung, Berufsbildung, eduQua',
    ARRAY[
        'Praktische Ausbildung im Gastro-Betrieb strukturiert aufbauen',
        'Rolle und Verantwortung als Berufsbildner/in im Lehrbetrieb klären',
        'Ausbildungsalltag organisieren und Lernende wirksam begleiten',
        'Anerkannten Kursausweis für die Ausbildungspraxis erlangen'
    ],
    'Keine formalen Voraussetzungen',
    NULL,
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'bildung_pruefung',
    'Ausbilder / SVEB',
    NULL,
    NULL,
    NULL,
    'https://www.bildungsprofi.ch/berufs-und-praxisbildner/kurse/alle-kurse/?tx_kursadmin_kursliste%5Bkurs%5D=48&tx_kursadmin_kursliste%5Baction%5D=show&tx_kursadmin_kursliste%5Bcontroller%5D=Kurs&cHash=0aeea3be539238c6495c62f179091022',
    'lead',
    'draft',
    true,
    'Aargau',
    NULL
) RETURNING id;

-- Kurs 5: Berufsbildner-Kurs Medizinische Praxis-Fachpersonen (MPA + MPK)
INSERT INTO courses (
    user_id,
    title,
    description,
    keywords,
    objectives,
    prerequisites,
    price,
    level,
    languages,
    delivery_types,
    category_type,
    category_area,
    category_specialty,
    category_focus,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro,
    canton,
    address
) VALUES (
    '474940af-bca6-4833-99fc-d6a79261ec6c'::uuid,
    'Berufsbildner-Kurs Medizinische Praxis-Fachpersonen (MPA + MPK)',
    'Dieser Berufsbildner-Kurs richtet sich an Personen, die in Arztpraxen Medizinische Praxisassistentinnen (MPA) oder Medizinische Praxiskoordinatorinnen (MPK) ausbilden. Der Kurs ist als notwendige Qualifizierung gemäss Berufsbildungsgesetz eingeordnet, sobald Lernende im Betrieb ausgebildet werden.

Inhaltlich unterstützt er dabei, die praktische Ausbildung strukturiert aufzubauen, die Rolle als Berufsbildner/in im Praxisalltag zu klären und Ausbildungsaufgaben planbar umzusetzen.

Die Durchführungen werden in Kooperation mit dem SVA angeboten; der Kursausweis ist schweizweit gültig. Für 2026 sind mehrere Durchführungen an verschiedenen Kursorten ausgeschrieben (u.a. Lenzburg, Luzern, St. Gallen, Zürich, Bern).',
    'MPA, MPK, Berufsbildnerkurs, Arztpraxis, Lernende ausbilden, Praxisanleitung, Ausbildungsplanung, SVA, Kursausweis, Lenzburg, SIU Zürich, Klubschule Migros, Berufsbildung',
    ARRAY[
        'Ausbildungsauftrag in der Arztpraxis sicher wahrnehmen',
        'Praktische Ausbildung von MPA/MPK strukturiert planen und begleiten',
        'Ausbildungsalltag organisieren und Lernfortschritte unterstützen',
        'Schweizweit anerkannten Kursausweis erlangen'
    ],
    'Keine formalen Voraussetzungen',
    760.00,
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'bildung_pruefung',
    'Ausbilder / SVEB',
    NULL,
    40,
    NULL,
    'https://www.bildungsprofi.ch/berufs-und-praxisbildner/kurse/alle-kurse/?tx_kursadmin_kursliste%5Bkurs%5D=4&tx_kursadmin_kursliste%5Baction%5D=show&tx_kursadmin_kursliste%5Bcontroller%5D=Kurs&cHash=d4d06eab7c678e820d89ed949bc046eb',
    'lead',
    'draft',
    true,
    NULL,
    NULL
) RETURNING id;

-- Kurs 6: Berufsbildner-Kurs Schaffhausen
INSERT INTO courses (
    user_id,
    title,
    description,
    keywords,
    objectives,
    prerequisites,
    price,
    level,
    languages,
    delivery_types,
    category_type,
    category_area,
    category_specialty,
    category_focus,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro,
    canton,
    address
) VALUES (
    '474940af-bca6-4833-99fc-d6a79261ec6c'::uuid,
    'Berufsbildner-Kurs Schaffhausen',
    'Dieser Berufsbildner-Kurs ist als kantonales Angebot im Kanton Schaffhausen ausgeschrieben und wird im Auftrag des Kantons durch apprendo gmbh durchgeführt. Der Kurs findet im Tagungszentrum Schönbühl statt und ist so eingeordnet, dass alle Anforderungen der kantonalen und eidgenössischen Gesetzgebung erfüllt werden.

Nach vollständigem Besuch wird der kantonale Ausweis abgegeben, der eidgenössisch gültig ist.

Inhaltlich unterstützt der Kurs Berufsbildnerinnen und Berufsbildner dabei, die praktische Ausbildung im Betrieb nachvollziehbar aufzubauen, die Rolle als Ausbildungsverantwortliche/r zu klären und typische Situationen mit Lernenden im Berufsalltag sicher zu gestalten.',
    'Schaffhausen, Berufsbildnerkurs, Lehrmeisterkurs, Lernende ausbilden, Praxisanleitung, Ausbildungsplanung, Kursausweis, Schönbühl, Berufsbildung, eduQua, Lehrbetrieb, Ausbildungsgespräche',
    ARRAY[
        'Praktische Ausbildung im Lehrbetrieb strukturiert gestalten',
        'Rolle und Verantwortung als Berufsbildner/in klären',
        'Ausbildungssituationen im Alltag sicher steuern',
        'Anerkannten Kursausweis für die Ausbildung von Lernenden erlangen'
    ],
    'Keine formalen Voraussetzungen',
    530.00,
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'bildung_pruefung',
    'Ausbilder / SVEB',
    NULL,
    40,
    NULL,
    'https://www.bildungsprofi.ch/berufs-und-praxisbildner/kurse/alle-kurse/?tx_kursadmin_kursliste%5Bkurs%5D=33&tx_kursadmin_kursliste%5Baction%5D=show&tx_kursadmin_kursliste%5Bcontroller%5D=Kurs&cHash=f1992171b5ed3556bdb6d8fff72995ba',
    'lead',
    'draft',
    true,
    'Schaffhausen',
    'Tagungszentrum Schönbühl'
) RETURNING id;

-- Kurs 7: Berufsbildner-Kurs SwissMechanic (Maschinen-, Elektro- und Metallberufe)
INSERT INTO courses (
    user_id,
    title,
    description,
    keywords,
    objectives,
    prerequisites,
    price,
    level,
    languages,
    delivery_types,
    category_type,
    category_area,
    category_specialty,
    category_focus,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro,
    canton,
    address
) VALUES (
    '474940af-bca6-4833-99fc-d6a79261ec6c'::uuid,
    'Berufsbildner-Kurs SwissMechanic (Maschinen-, Elektro- und Metallberufe)',
    'Dieser Berufsbildner-Kurs richtet sich an Berufsbildnerinnen und Berufsbildner in Maschinen-, Elektro- und Metallberufen und ist als Qualifizierung gemäss Berufsbildungsgesetz eingeordnet. Der Kurs wird in Zusammenarbeit mit SwissMechanic angeboten und ist so konzipiert, dass die praktische Ausbildung von Lernenden im Betrieb strukturiert und sicher umgesetzt werden kann.

Im Mittelpunkt stehen der Aufbau einer nachvollziehbaren Ausbildungsplanung, die Klärung der Rolle als Berufsbildner/in sowie der Umgang mit typischen Ausbildungssituationen im Berufsalltag.

Der Kursausweis ist in der ganzen Schweiz gültig. Für 2026 sind Durchführungen mit Kursorten in Münchenbuchsee sowie Brugg publiziert.',
    'SwissMechanic, Berufsbildnerkurs, Metallberufe, Elektroberufe, Maschinenberufe, Lernende ausbilden, Praxisanleitung, Ausbildungsplanung, Kursausweis, Münchenbuchsee, Brugg, Berufsbildung',
    ARRAY[
        'Praktische Ausbildung in technischen Berufen systematisch planen',
        'Rolle als Berufsbildner/in im Lehrbetrieb sicher wahrnehmen',
        'Lernende im Arbeitsprozess wirksam anleiten und begleiten',
        'Schweizweit anerkannten Kursausweis erlangen'
    ],
    'Keine formalen Voraussetzungen',
    790.00,
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'bildung_pruefung',
    'Ausbilder / SVEB',
    NULL,
    40,
    NULL,
    'https://www.bildungsprofi.ch/berufs-und-praxisbildner/kurse/alle-kurse/?tx_kursadmin_kursliste%5Bkurs%5D=8&tx_kursadmin_kursliste%5Baction%5D=show&tx_kursadmin_kursliste%5Bcontroller%5D=Kurs&cHash=e2b0d41eac81aad4ff05c7f55779dbd9',
    'lead',
    'draft',
    true,
    NULL,
    NULL
) RETURNING id;

-- Kurs 8: Berufsbildner-Kurs Tiermedizinische Praxisassistentinnen (TPA)
INSERT INTO courses (
    user_id,
    title,
    description,
    keywords,
    objectives,
    prerequisites,
    price,
    level,
    languages,
    delivery_types,
    category_type,
    category_area,
    category_specialty,
    category_focus,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro,
    canton,
    address
) VALUES (
    '474940af-bca6-4833-99fc-d6a79261ec6c'::uuid,
    'Berufsbildner-Kurs Tiermedizinische Praxisassistentinnen (TPA)',
    'Dieser Berufsbildner-Kurs richtet sich an Personen, die Tiermedizinische Praxisassistentinnen (TPA) im Betrieb ausbilden. Der Kurs ist als Qualifizierung gemäss Berufsbildungsgesetz eingeordnet und unterstützt dabei, die praktische Ausbildung in der Tierarztpraxis strukturiert aufzubauen und im Alltag konsequent umzusetzen.

Angeboten wird der Kurs in Kooperation mit dem GST. Der Kursausweis ist in der ganzen Schweiz gültig, sodass die Wahl des Kursorts innerhalb der ausgeschriebenen Angebote flexibel möglich ist.

Damit erhalten Berufsbildner/innen eine klare, formale Grundlage, um Lernende in der Praxis fachlich begleitet auszubilden und die Ausbildung im Betrieb planbar zu organisieren.',
    'TPA, Tiermedizin, Berufsbildnerkurs, Tierarztpraxis, Lernende ausbilden, Praxisanleitung, Ausbildungsplanung, GST, Kursausweis, SIU Zürich, Berufsbildung, Lehrbetrieb',
    ARRAY[
        'Praktische Ausbildung von TPA im Betrieb strukturiert planen',
        'Rolle als Berufsbildner/in in der Tierarztpraxis klären',
        'Ausbildungsalltag organisieren und Lernende wirksam begleiten',
        'Schweizweit anerkannten Kursausweis erlangen'
    ],
    'Keine formalen Voraussetzungen',
    790.00,
    'beginner',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'bildung_pruefung',
    'Ausbilder / SVEB',
    NULL,
    40,
    NULL,
    'https://www.bildungsprofi.ch/berufs-und-praxisbildner/kurse/alle-kurse/?tx_kursadmin_kursliste%5Bkurs%5D=5&tx_kursadmin_kursliste%5Baction%5D=show&tx_kursadmin_kursliste%5Bcontroller%5D=Kurs&cHash=70002145ae07c491024db3d7076485f7',
    'lead',
    'draft',
    true,
    NULL,
    NULL
) RETURNING id;

-- Kurs 9: Berufsbildner-Kurs Zahnärztin/Zahnarzt (SSO) – Führung
INSERT INTO courses (
    user_id,
    title,
    description,
    keywords,
    objectives,
    prerequisites,
    price,
    level,
    languages,
    delivery_types,
    category_type,
    category_area,
    category_specialty,
    category_focus,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro,
    canton,
    address
) VALUES (
    '474940af-bca6-4833-99fc-d6a79261ec6c'::uuid,
    'Berufsbildner-Kurs Zahnärztin/Zahnarzt (SSO) – Führung',
    'Dieser Berufsbildner-Kurs verbindet Führungs- und Ausbildungsthemen für Praxisbesitzer/innen im zahnmedizinischen Umfeld. Er richtet sich an Zahnärztinnen und Zahnärzte, die Mitarbeitende (z.B. DA, DH, PA) führen, betreuen und Lernende auf die Berufswelt vorbereiten.

Der Kurs setzt bei typischen Herausforderungen in der Praxisführung an, etwa unterschiedlichen Erwartungen zu Verantwortung und Befugnissen oder alters- und reifebedingten Unterschieden im Team. Ziel ist, Führung zu optimieren, Delegation zu professionalisieren und Aus- sowie Weiterbildung der Mitarbeitenden fördernd umzusetzen.

Bei vollständigem Besuch wird der kantonale, eidgenössisch gültige Berufsbildner-Kursausweis erlangt. Der Kurs ist SSO-geprüft und wird mit 30 Fortbildungsstunden anerkannt.',
    'SSO, Zahnärztin, Zahnarzt, Praxisführung, Berufsbildnerkurs, Delegation, Mitarbeitendenführung, Lernende ausbilden, Kursausweis, Fortbildungsstunden, SIU Zürich, Ausbildungsqualität, Kommunikation',
    ARRAY[
        'Führung in der Praxis gezielt weiterentwickeln',
        'Delegation und Verantwortlichkeiten im Team klar gestalten',
        'Ausbildung und Weiterbildung von Mitarbeitenden fördernd steuern',
        'Anerkannten Berufsbildner-Kursausweis für die Praxisausbildung erlangen'
    ],
    'Keine formalen Voraussetzungen',
    660.00,
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'business_mgmt',
    'Leadership & Teamführung',
    NULL,
    40,
    NULL,
    'https://www.bildungsprofi.ch/berufs-und-praxisbildner/kurse/alle-kurse/?tx_kursadmin_kursliste%5Bkurs%5D=24&tx_kursadmin_kursliste%5Baction%5D=show&tx_kursadmin_kursliste%5Bcontroller%5D=Kurs&cHash=d9e5b0bce93cd67eb05b40db74ec78e6',
    'lead',
    'draft',
    true,
    'Zürich',
    NULL
) RETURNING id;

-- Kurs 10: Berufsbildner-Kurs Ärztin / Arzt (FMH) – Führung
INSERT INTO courses (
    user_id,
    title,
    description,
    keywords,
    objectives,
    prerequisites,
    price,
    level,
    languages,
    delivery_types,
    category_type,
    category_area,
    category_specialty,
    category_focus,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro,
    canton,
    address
) VALUES (
    '474940af-bca6-4833-99fc-d6a79261ec6c'::uuid,
    'Berufsbildner-Kurs Ärztin / Arzt (FMH) – Führung',
    'Dieser Berufsbildner-Kurs richtet sich an Ärztinnen und Ärzte, die als Praxisbesitzer/innen Mitarbeitende führen und Lernende in der Praxis ausbilden. Er greift Führung in der Praxis als zentrale Aufgabe auf, insbesondere in Konstellationen mit unterschiedlichen Werdegängen, Erwartungen an Verantwortung und Befugnisse sowie alters- und reifebedingten Unterschieden im Team.

Ziel ist, Führung zu optimieren, Delegation zu professionalisieren und die Aus- sowie Weiterbildung der Mitarbeitenden fördernd umzusetzen.

Mit vollständigem Besuch wird der kantonale, eidgenössisch gültige Berufsbildner-Kursausweis erlangt. Der Kurs ist SIWF-approved und wird mit 25 Fortbildungs-Credits anerkannt.',
    'FMH, SIWF, Ärztin, Arzt, Praxisführung, Berufsbildnerkurs, Delegation, Teamführung, Lernende ausbilden, Kursausweis, Fortbildungs-Credits, SIU Zürich, Kommunikation',
    ARRAY[
        'Führung im Praxisalltag gezielt verbessern',
        'Delegation und Verantwortlichkeiten wirksam gestalten',
        'Mitarbeitende und Lernende entwicklungsorientiert begleiten',
        'Anerkannten Berufsbildner-Kursausweis und Fortbildungs-Credits erwerben'
    ],
    'Keine formalen Voraussetzungen',
    660.00,
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'business_mgmt',
    'Leadership & Teamführung',
    NULL,
    40,
    NULL,
    'https://www.bildungsprofi.ch/berufs-und-praxisbildner/kurse/alle-kurse/?tx_kursadmin_kursliste%5Bkurs%5D=23&tx_kursadmin_kursliste%5Baction%5D=show&tx_kursadmin_kursliste%5Bcontroller%5D=Kurs&cHash=848e102aca50733d5d53006c36588603',
    'lead',
    'draft',
    true,
    'Zürich',
    NULL
) RETURNING id;

-- Kurs 11: Die richtigen Lernenden finden – Lehrstellenmarketing
INSERT INTO courses (
    user_id,
    title,
    description,
    keywords,
    objectives,
    prerequisites,
    price,
    level,
    languages,
    delivery_types,
    category_type,
    category_area,
    category_specialty,
    category_focus,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro,
    canton,
    address
) VALUES (
    '474940af-bca6-4833-99fc-d6a79261ec6c'::uuid,
    'Die richtigen Lernenden finden – Lehrstellenmarketing',
    'Dieses Seminar fokussiert auf die Herausforderung, passende Lernende für den eigenen Betrieb zu gewinnen. Es thematisiert Situationen, in denen entweder sehr viele Bewerbungen eingehen, aber die Passung zum Betrieb oder Beruf fehlt, oder – insbesondere in handwerklichen Berufen – zu wenige oder gar keine Bewerbungen eintreffen.

Der Inhalt ist auf Lehrstellenmarketing als Teil des Personalmarketings ausgerichtet: Wie kann der Betrieb seine Lehrstelle so positionieren, dass sich die Zielgruppe angesprochen fühlt, und wie lassen sich Auswahl und Ansprache so gestalten, dass am Ende Lernende gefunden werden, die fachlich und menschlich passen?

Das Seminar eignet sich für Ausbildungsverantwortliche, Berufsbildner/innen sowie Personen mit Verantwortung für Rekrutierung und Nachwuchsförderung.',
    'Lehrstellenmarketing, Lernende finden, Recruiting, Personalmarketing, Nachwuchs, Bewerbungen, Auswahlprozess, Arbeitgeberattraktivität, Berufsbildner, Lehrbetrieb, Candidate Journey, Handwerk, Fachkräftemangel',
    ARRAY[
        'Aktuelle Herausforderungen im Lehrstellenmarketing einordnen',
        'Zielgerichtete Ansprache potenzieller Lernender verbessern',
        'Recruiting-Logik für Lehrstellen im Betrieb strukturieren',
        'Passung zwischen Betrieb, Beruf und Bewerbenden erhöhen'
    ],
    'Keine formalen Voraussetzungen',
    NULL,
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'hr_recht',
    'Recruiting & Personalmarketing',
    NULL,
    NULL,
    NULL,
    'https://www.bildungsprofi.ch/berufs-und-praxisbildner/kurse/alle-kurse/?tx_kursadmin_kursliste%5Bkurs%5D=11&tx_kursadmin_kursliste%5Baction%5D=show&tx_kursadmin_kursliste%5Bcontroller%5D=Kurs&cHash=c3042665027dbe64aa6b934dcde22df6',
    'lead',
    'draft',
    true,
    NULL,
    NULL
) RETURNING id;

-- Kurs 12: Instruieren, Trainieren, Coachen – Mitarbeitende entwickeln
INSERT INTO courses (
    user_id,
    title,
    description,
    keywords,
    objectives,
    prerequisites,
    price,
    level,
    languages,
    delivery_types,
    category_type,
    category_area,
    category_specialty,
    category_focus,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro,
    canton,
    address
) VALUES (
    '474940af-bca6-4833-99fc-d6a79261ec6c'::uuid,
    'Instruieren, Trainieren, Coachen – Mitarbeitende entwickeln',
    'Dieses Seminar richtet sich an Personen, die Mitarbeitende oder Lernende im Arbeitsalltag anleiten, trainieren und coachen. Es greift die Frage auf, wie Wissen so vermittelt wird, dass es im Alltag zuverlässig umgesetzt werden kann: von der Instruktion über das Training bis zur begleitenden Unterstützung beim Transfer.

Der Kurs eignet sich für Ausbildner/innen, Berufsbildner/innen sowie Führungskräfte, die Mitarbeitende gezielt in Aufgaben einführen oder in der Leistung verbessern wollen.

Für 2026 sind Durchführungen in Brugg publiziert.',
    'Instruieren, Trainieren, Coachen, Mitarbeitendenentwicklung, Onboarding, Feedback, Lerntransfer, Praxisanleitung, Ausbildner, Führung, Kompetenzaufbau, Brugg, Kommunikation, Lernbegleitung',
    ARRAY[
        'Instruktion, Training und Coaching im Arbeitskontext unterscheiden',
        'Mitarbeitende zielgerichtet an Aufgaben heranführen',
        'Transfer in den Alltag durch passende Begleitung unterstützen',
        'Entwicklungsgespräche und Feedback situationsgerecht einsetzen'
    ],
    'Keine formalen Voraussetzungen',
    380.00,
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'business_mgmt',
    'Leadership & Teamführung',
    NULL,
    8,
    NULL,
    'https://www.bildungsprofi.ch/berufs-und-praxisbildner/kurse/alle-kurse/?tx_kursadmin_kursliste%5Bkurs%5D=19&tx_kursadmin_kursliste%5Baction%5D=show&tx_kursadmin_kursliste%5Bcontroller%5D=Kurs&cHash=d0d05f20ac5bd71f570bd1174ef9383a',
    'lead',
    'draft',
    true,
    'Aargau',
    'Brugg'
) RETURNING id;

-- Kurs 13: Konfliktmanagement – Umgang mit Konflikten
INSERT INTO courses (
    user_id,
    title,
    description,
    keywords,
    objectives,
    prerequisites,
    price,
    level,
    languages,
    delivery_types,
    category_type,
    category_area,
    category_specialty,
    category_focus,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro,
    canton,
    address
) VALUES (
    '474940af-bca6-4833-99fc-d6a79261ec6c'::uuid,
    'Konfliktmanagement – Umgang mit Konflikten',
    'Dieses Seminar fokussiert auf den konstruktiven Umgang mit Konflikten im Arbeitsalltag. Es nimmt die persönliche Reaktion in Konfliktsituationen in den Blick und schafft Orientierung, warum Konflikte eskalieren können und wie sich festgefahrene Situationen wieder handlungsfähig machen lassen.

Ziel ist, Konflikte so zu bearbeiten, dass tragfähige Lösungen entstehen und die Zusammenarbeit gestärkt wird.

Der Kurs eignet sich für Berufsbildner/innen, Ausbildner/innen, Führungskräfte und Personen mit Verantwortung für Teamarbeit, die Konflikte frühzeitig erkennen und wirksam adressieren wollen. Für 2026 ist eine Durchführung in Brugg publiziert.',
    'Konfliktmanagement, Konflikte lösen, Kommunikation, Deeskalation, Teamkonflikte, Gesprächsführung, Win-Win, Führung, Berufsbildner, Ausbildner, Brugg, Feedback, Zusammenarbeit, Mediation',
    ARRAY[
        'Eigenes Konfliktverhalten verstehen und reflektieren',
        'Konfliktdynamiken erkennen und angemessen reagieren',
        'Lösungsorientierte Vorgehensweisen im Konflikt anwenden',
        'Win-Win-Ansätze zur Stabilisierung der Zusammenarbeit einsetzen'
    ],
    'Keine formalen Voraussetzungen',
    380.00,
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'soft_skills',
    'Konfliktmanagement',
    NULL,
    8,
    NULL,
    'https://www.bildungsprofi.ch/berufs-und-praxisbildner/kurse/alle-kurse/?tx_kursadmin_kursliste%5Bkurs%5D=17&tx_kursadmin_kursliste%5Baction%5D=show&tx_kursadmin_kursliste%5Bcontroller%5D=Kurs&cHash=84c7011b0d06f590e5729713a22e6777',
    'lead',
    'draft',
    true,
    'Aargau',
    'Brugg'
) RETURNING id;

-- Kurs 14: Refresher für praktische Ausbildung der Dentalassistentinnen
INSERT INTO courses (
    user_id,
    title,
    description,
    keywords,
    objectives,
    prerequisites,
    price,
    level,
    languages,
    delivery_types,
    category_type,
    category_area,
    category_specialty,
    category_focus,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro,
    canton,
    address
) VALUES (
    '474940af-bca6-4833-99fc-d6a79261ec6c'::uuid,
    'Refresher für praktische Ausbildung der Dentalassistentinnen',
    'Dieser Refresher richtet sich an Berufsbildnerinnen und Berufsbildner, die Dentalassistentinnen und Dentalassistenten praktisch ausbilden und ihre Umsetzungssicherheit im aktuellen Bildungsplan stärken möchten.

Thematisch knüpft der Kurs an Änderungen in Bildungsverordnung und Bildungsplan an, die auf eine intensivere Zusammenarbeit zwischen Betrieb, Schule und überbetrieblichen Kursen ausgerichtet sind. Der Bildungsplan ist handlungskompetenzorientiert aufgebaut; der Refresher unterstützt dabei, die Anforderungen in der betrieblichen Praxis einzuordnen und die Organisation der Ausbildung (Aufgabenteilung und Zeitmanagement) zu klären.

Eine Inhouse-Durchführung im Betrieb ist als Möglichkeit erwähnt (Offerte auf Anfrage).',
    'Refresher, Dentalassistenz, Berufsbildner, Bildungsplan, BiVo, Handlungskompetenzen, Lernorte, ÜK, Ausbildungsorganisation, Zeitmanagement, Praxisanleitung, Inhouse, Ausbildung Zahnarztpraxis, Lernende begleiten',
    ARRAY[
        'Aktuelle Anforderungen aus BiVo/Bildungsplan in die Praxis übersetzen',
        'Zusammenarbeit der Lernorte Betrieb, Schule und ÜK gezielt unterstützen',
        'Ausbildungsorganisation, Aufgabenteilung und Zeitmanagement klären',
        'Handlungskompetenzorientierte Ausbildungslogik sicher anwenden'
    ],
    'Tätigkeit als Berufsbildner/in in der praktischen Ausbildung von Dentalassistentinnen/Dentalassistenten',
    NULL,
    'advanced',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'bildung_pruefung',
    'Ausbilder / SVEB',
    NULL,
    NULL,
    NULL,
    'https://www.bildungsprofi.ch/berufs-und-praxisbildner/kurse/alle-kurse/?tx_kursadmin_kursliste%5Bkurs%5D=39&tx_kursadmin_kursliste%5Baction%5D=show&tx_kursadmin_kursliste%5Bcontroller%5D=Kurs&cHash=b4ed1e9f408e57120ddf46afe7215a5a',
    'lead',
    'draft',
    true,
    NULL,
    NULL
) RETURNING id;

-- Kurs 15: Refresher für praktische Ausbildung der MPA
INSERT INTO courses (
    user_id,
    title,
    description,
    keywords,
    objectives,
    prerequisites,
    price,
    level,
    languages,
    delivery_types,
    category_type,
    category_area,
    category_specialty,
    category_focus,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro,
    canton,
    address
) VALUES (
    '474940af-bca6-4833-99fc-d6a79261ec6c'::uuid,
    'Refresher für praktische Ausbildung der MPA',
    'Dieser Refresher richtet sich an Arztpraxen und Berufsbildner/innen, die MPA praktisch ausbilden und ihre Ausbildungspraxis an aktuelle Vorgaben und Arbeitsmarktanforderungen anpassen wollen.

Thematisch greift der Kurs wiederkehrende Änderungen in Bildungsverordnungen und Bildungsplänen auf sowie die laufende Überarbeitung von Bildungsunterlagen. Zudem wird die Frage adressiert, welche Inhalte heute in der Praxis relevant sind und wie Lernende passend begleitet werden können.

Der Kurs kann auf Wunsch auch Inhouse in einer Arztpraxis durchgeführt werden (Offerte auf Anfrage).',
    'Refresher, MPA, Arztpraxis, Berufsbildner, Bildungsplan, BiVo, Ausbildungsunterlagen, Praxisleitfaden, Inhouse, Lernende begleiten, Ausbildungsorganisation, Arbeitsmarkt, Praxisanleitung, Ausbildung aktualisieren',
    ARRAY[
        'Aktuelle Ausbildungsanforderungen für MPA einordnen',
        'Betriebliche Ausbildungspraxis an aktuelle Rahmenbedingungen anpassen',
        'Relevante Tools und Ausbildungsunterlagen gezielt nutzen',
        'Inhouse-Umsetzung im Praxisalltag sinnvoll planen'
    ],
    'Tätigkeit als Berufsbildner/in oder Verantwortung in der praktischen Ausbildung von MPA',
    NULL,
    'advanced',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'bildung_pruefung',
    'Ausbilder / SVEB',
    NULL,
    NULL,
    NULL,
    'https://www.bildungsprofi.ch/berufs-und-praxisbildner/kurse/alle-kurse/?tx_kursadmin_kursliste%5Bkurs%5D=2&tx_kursadmin_kursliste%5Baction%5D=show&tx_kursadmin_kursliste%5Bcontroller%5D=Kurs&cHash=c990c97e555091d00c31bbbe58ab207a',
    'lead',
    'draft',
    true,
    NULL,
    NULL
) RETURNING id;

-- Kurs 16: Schwierige Situationen mit Lernenden lösen
INSERT INTO courses (
    user_id,
    title,
    description,
    keywords,
    objectives,
    prerequisites,
    price,
    level,
    languages,
    delivery_types,
    category_type,
    category_area,
    category_specialty,
    category_focus,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro,
    canton,
    address
) VALUES (
    '474940af-bca6-4833-99fc-d6a79261ec6c'::uuid,
    'Schwierige Situationen mit Lernenden lösen',
    'Dieses Seminar richtet sich an Ausbildner/innen und Berufsbildner/innen, die Lernende begleiten und in herausfordernden Situationen handlungsfähig bleiben wollen. Es beschreibt schwierige Situationen mit Lernenden als anspruchsvolle Aufgabe, weil während der Lehrzeit viele Belastungsfaktoren zusammenkommen können – etwa Schule und Notendruck, Probleme im Elternhaus, Pubertät, Beziehungen oder gesundheitliche Themen.

Der Kurs setzt an dieser Realität an und bietet einen Rahmen, um solche Situationen einzuordnen und Lösungswege zu entwickeln.

Ziel ist, im Lehrbetrieb passend zu reagieren, Orientierung zu geben und Konflikte bzw. Belastungen so zu bearbeiten, dass Ausbildung und Zusammenarbeit stabil bleiben.',
    'Lernende, schwierige Situationen, Ausbildner, Berufsbildner, Konflikte, Pubertät, Schulstress, Gesprächsführung, Unterstützung, Lehrbetrieb, Ausbildungskrise, Problemlösung, Kommunikation, Begleitung',
    ARRAY[
        'Belastungsfaktoren bei Lernenden erkennen und einordnen',
        'In schwierigen Situationen als Ausbildner/in sicher reagieren',
        'Lösungswege für den Ausbildungsalltag entwickeln',
        'Zusammenarbeit und Ausbildung auch in Belastungsphasen stabilisieren'
    ],
    'Keine formalen Voraussetzungen',
    NULL,
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'soft_skills',
    'Kommunikation',
    NULL,
    NULL,
    NULL,
    'https://www.bildungsprofi.ch/berufs-und-praxisbildner/kurse/alle-kurse/?tx_kursadmin_kursliste%5Bkurs%5D=46&tx_kursadmin_kursliste%5Baction%5D=show&tx_kursadmin_kursliste%5Bcontroller%5D=Kurs&cHash=7f8e7e88fc4e0c84d011214acf917906',
    'lead',
    'draft',
    true,
    NULL,
    NULL
) RETURNING id;

-- Kurs 17: Störungen im Unterricht
INSERT INTO courses (
    user_id,
    title,
    description,
    keywords,
    objectives,
    prerequisites,
    price,
    level,
    languages,
    delivery_types,
    category_type,
    category_area,
    category_specialty,
    category_focus,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro,
    canton,
    address
) VALUES (
    '474940af-bca6-4833-99fc-d6a79261ec6c'::uuid,
    'Störungen im Unterricht',
    'Dieser Kurs thematisiert Störungen im Unterricht und zeigt einen Aufbau, der das Erproben und Auswerten von Massnahmen bewusst integriert. Der Kurs erstreckt sich über zwei Abende innerhalb von drei Wochen: Am ersten Abend werden Informationen und Hintergründe vermittelt, um eine fundierte Basis zu schaffen.

In den anschliessenden Wochen werden erste Massnahmen im realen Alltag ausprobiert. Am zweiten Abend werden diese Erfahrungen gemeinsam ausgewertet und um weitere Lösungsansätze ergänzt.

Dadurch entsteht eine praxisnahe Lernschleife, die nicht nur Wissen vermittelt, sondern die Umsetzung im eigenen Kontext sichtbar macht.',
    'Unterrichtsstörungen, Classroom Management, Unterricht, Massnahmen, Reflexion, Auswertung, Lehrpersonen, Kursabend, Lösungsansätze, Verhalten, Lernumfeld, Praxisumsetzung, Didaktik, Lernklima',
    ARRAY[
        'Störungen im Unterricht systematisch einordnen',
        'Erste Massnahmen im eigenen Kontext gezielt erproben',
        'Erfahrungen reflektieren und wirksam nachjustieren',
        'Weitere Lösungsansätze für den Unterrichtsalltag ableiten'
    ],
    'Keine formalen Voraussetzungen',
    NULL,
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'bildung_pruefung',
    'Erwachsenenbildung',
    NULL,
    NULL,
    '2 Abende (innerhalb von 3 Wochen)',
    'https://www.bildungsprofi.ch/berufs-und-praxisbildner/kurse/alle-kurse/?tx_kursadmin_kursliste%5Bkurs%5D=12&tx_kursadmin_kursliste%5Baction%5D=show&tx_kursadmin_kursliste%5Bcontroller%5D=Kurs&cHash=39b488d3b25534c6ee0aa70220488a6c',
    'lead',
    'draft',
    true,
    NULL,
    NULL
) RETURNING id;

-- Kurs 18: Trauerbegleitung: Vereinbarkeit von Begleitung und Selbstschutz
INSERT INTO courses (
    user_id,
    title,
    description,
    keywords,
    objectives,
    prerequisites,
    price,
    level,
    languages,
    delivery_types,
    category_type,
    category_area,
    category_specialty,
    category_focus,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro,
    canton,
    address
) VALUES (
    '474940af-bca6-4833-99fc-d6a79261ec6c'::uuid,
    'Trauerbegleitung: Vereinbarkeit von Begleitung und Selbstschutz',
    'Dieser Kurs fokussiert auf Trauerbegleitung mit besonderem Blick auf die Balance zwischen empathischer Unterstützung und dem eigenen Selbstschutz. Im Zentrum steht die Frage, wie Menschen in Trauer achtsam begleitet werden können, ohne dabei die eigenen Grenzen zu übergehen.

Thematisch eignet sich das Format für Personen, die im beruflichen oder privaten Kontext mit Trauerprozessen in Berührung kommen und ihre Haltung, Kommunikation und Stabilität im Umgang mit belastenden Situationen weiterentwickeln möchten.

Der Kurs berücksichtigt sowohl Begleitkompetenz als auch Abgrenzung und Ressourcenpflege.',
    'Trauerbegleitung, Selbstschutz, Abgrenzung, Kommunikation, Verlust, Begleitung, Resilienz, Ressourcen, Belastung, Palliative Care, Angehörige, Trauerprozess, Gesprächsführung, psychosoziale Unterstützung',
    ARRAY[
        'Trauerprozesse im Begleitkontext besser einordnen',
        'Unterstützende Kommunikation in belastenden Situationen stärken',
        'Eigene Grenzen erkennen und Selbstschutz im Alltag verankern',
        'Ressourcen zur Stabilisierung im Begleitprozess nutzen'
    ],
    'Keine formalen Voraussetzungen',
    NULL,
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'gesundheit_beruf',
    'Pflege & Betreuung',
    NULL,
    NULL,
    NULL,
    'https://www.bildungsprofi.ch/berufs-und-praxisbildner/kurse/alle-kurse/?tx_kursadmin_kursliste%5Bkurs%5D=26&tx_kursadmin_kursliste%5Baction%5D=show&tx_kursadmin_kursliste%5Bcontroller%5D=Kurs&cHash=b8c2004b2df9a230d77f6dbaf9bf7510',
    'lead',
    'draft',
    true,
    NULL,
    NULL
) RETURNING id;

-- Kurs 19: Von der Diagnose bis zum Tod: Umgang mit Sterben und Tod
INSERT INTO courses (
    user_id,
    title,
    description,
    keywords,
    objectives,
    prerequisites,
    price,
    level,
    languages,
    delivery_types,
    category_type,
    category_area,
    category_specialty,
    category_focus,
    session_count,
    session_length,
    provider_url,
    booking_type,
    status,
    is_pro,
    canton,
    address
) VALUES (
    '474940af-bca6-4833-99fc-d6a79261ec6c'::uuid,
    'Von der Diagnose bis zum Tod: Umgang mit Sterben und Tod',
    'Dieser Kurs thematisiert den professionellen und persönlichen Umgang mit Sterben und Tod. Er richtet sich an Fachpersonen aus dem Gesundheits- und Sozialwesen sowie an Personen, die in ihrem beruflichen oder privaten Umfeld mit dem Thema Sterbebegleitung konfrontiert sind.

Der Kurs bietet einen Rahmen, um sich mit den verschiedenen Phasen vom Erhalt einer Diagnose bis zum Lebensende auseinanderzusetzen und die eigene Haltung sowie Handlungskompetenz in diesem sensiblen Bereich zu reflektieren und weiterzuentwickeln.',
    'Sterbebegleitung, Tod, Palliative Care, Diagnose, Lebensende, Trauerarbeit, Hospiz, Gesprächsführung, Ethik, Angehörige, Gesundheitswesen, Kommunikation, Selbstreflexion',
    ARRAY[
        'Phasen von der Diagnose bis zum Lebensende verstehen',
        'Eigene Haltung im Umgang mit Sterben reflektieren',
        'Kommunikation mit Betroffenen und Angehörigen stärken',
        'Handlungskompetenz in der Sterbebegleitung entwickeln'
    ],
    'Keine formalen Voraussetzungen',
    NULL,
    'all_levels',
    ARRAY['Deutsch'],
    ARRAY['presence'],
    'beruflich',
    'gesundheit_beruf',
    'Pflege & Betreuung',
    NULL,
    NULL,
    NULL,
    'https://www.bildungsprofi.ch/berufs-und-praxisbildner/kurse/alle-kurse/?tx_kursadmin_kursliste%5Bkurs%5D=25&tx_kursadmin_kursliste%5Baction%5D=show&tx_kursadmin_kursliste%5Bcontroller%5D=Kurs&cHash=aff322db3d672cfd2c7db90dad88b30a',
    'lead',
    'draft',
    true,
    NULL,
    NULL
) RETURNING id;
