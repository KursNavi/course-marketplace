// Debug script to check Supabase data for category filtering issue
// Run with: node debug-supabase.js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nplxmpfasgpumpiddjfl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wbHhtcGZhc2dwdW1waWRkamZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMzk5NDIsImV4cCI6MjA3OTkxNTk0Mn0.JPgHg1DDqnkUJv4zxkZ6C3Tpmcj9Tclbo8pIsoCEWSA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugCategoryData() {
  console.log('=== Debugging Supabase Category Data ===\n');

  // 1. Check taxonomy_level3 for "Naturkunde & Kräuter"
  console.log('1. Looking for "Naturkunde & Kräuter" in taxonomy_level3...');
  const { data: level3Data, error: level3Error } = await supabase
    .from('taxonomy_level3')
    .select('*')
    .ilike('label', '%Naturkunde%');

  if (level3Error) {
    console.error('Error:', level3Error);
  } else {
    console.log('Found level3 entries:', JSON.stringify(level3Data, null, 2));
  }

  // 2. Check all level3 entries under level2 "Freizeit & Natur" (id=8)
  console.log('\n2. All level3 entries under level2_id = 8 (Freizeit & Natur)...');
  const { data: level3Under8, error: level3Under8Error } = await supabase
    .from('taxonomy_level3')
    .select('*')
    .eq('level2_id', 8);

  if (level3Under8Error) {
    console.error('Error:', level3Under8Error);
  } else {
    console.log('Level3 entries:', JSON.stringify(level3Under8, null, 2));
  }

  // 3. Check course_category_assignments for level3_id = 28
  console.log('\n3. Course assignments for level3_id = 28...');
  const { data: assignments28, error: assignments28Error } = await supabase
    .from('course_category_assignments')
    .select('*, courses(id, title, status)')
    .eq('level3_id', 28);

  if (assignments28Error) {
    console.error('Error:', assignments28Error);
  } else {
    console.log('Assignments:', JSON.stringify(assignments28, null, 2));
  }

  // 4. Check ALL course_category_assignments
  console.log('\n4. All course_category_assignments...');
  const { data: allAssignments, error: allAssignmentsError } = await supabase
    .from('course_category_assignments')
    .select('*, courses(id, title, status)');

  if (allAssignmentsError) {
    console.error('Error:', allAssignmentsError);
  } else {
    console.log('Total assignments:', allAssignments?.length);
    console.log('Assignments with published courses:',
      allAssignments?.filter(a => a.courses?.status === 'published').length);
    console.log('\nAll assignments detail:');
    allAssignments?.forEach(a => {
      console.log(`  - Course ${a.course_id} (${a.courses?.title || 'N/A'}) -> level3: ${a.level3_id}, level4: ${a.level4_id}, status: ${a.courses?.status}`);
    });
  }

  // 5. Check courses table directly
  console.log('\n5. All courses with their status...');
  const { data: allCourses, error: coursesError } = await supabase
    .from('courses')
    .select('id, title, status, category_specialty, category_specialty_label');

  if (coursesError) {
    console.error('Error:', coursesError);
  } else {
    console.log('Total courses:', allCourses?.length);
    console.log('Published courses:', allCourses?.filter(c => c.status === 'published').length);
    console.log('\nCourses detail:');
    allCourses?.forEach(c => {
      console.log(`  - [${c.status}] ${c.id}: "${c.title}" (specialty: ${c.category_specialty}, label: ${c.category_specialty_label})`);
    });
  }

  // 6. Check if any courses match "Naturkunde" or "Heilpflanzen" in specialty
  console.log('\n6. Courses with "Naturkunde" or "Heilpflanzen" in specialty...');
  const { data: naturkundeCourses, error: naturkundeError } = await supabase
    .from('courses')
    .select('id, title, status, category_specialty, category_specialty_label')
    .or('category_specialty.ilike.%naturkunde%,category_specialty.ilike.%heilpflanzen%,category_specialty_label.ilike.%naturkunde%,category_specialty_label.ilike.%heilpflanzen%');

  if (naturkundeError) {
    console.error('Error:', naturkundeError);
  } else {
    console.log('Found:', JSON.stringify(naturkundeCourses, null, 2));
  }

  // 7. Check the view_published_courses_with_categories view
  console.log('\n7. Checking view_published_courses_with_categories...');
  const { data: viewData, error: viewError } = await supabase
    .from('view_published_courses_with_categories')
    .select('*')
    .limit(5);

  if (viewError) {
    console.error('Error (view may not exist):', viewError.message);
  } else {
    console.log('Sample from view:', JSON.stringify(viewData, null, 2));
  }

  // 8. Simulate the loadCourseCounts logic
  console.log('\n8. Simulating loadCourseCounts logic...');

  // Get all level3 with their level2_ids
  const { data: level3All, error: level3AllError } = await supabase
    .from('taxonomy_level3')
    .select('id, level2_id, label_de, slug')
    .eq('is_active', true);

  if (level3AllError) {
    console.error('Error:', level3AllError);
  } else {
    console.log('Level3 count:', level3All?.length);
  }

  // Get all level2 with their level1_ids
  const { data: level2All, error: level2AllError } = await supabase
    .from('taxonomy_level2')
    .select('id, level1_id, label_de, slug')
    .eq('is_active', true);

  if (level2AllError) {
    console.error('Error:', level2AllError);
  } else {
    console.log('Level2 count:', level2All?.length);
  }

  // Now simulate the courseCounts calculation
  const { data: pubAssignments, error: pubAssignmentsError } = await supabase
    .from('course_category_assignments')
    .select('level3_id, level4_id, courses!inner(status)')
    .eq('courses.status', 'published');

  if (pubAssignmentsError) {
    console.error('Error loading published assignments:', pubAssignmentsError);
  } else {
    console.log('\nPublished course assignments count:', pubAssignments?.length);

    // Build lookup maps
    const level3ToLevel2 = {};
    const level2ToLevel1 = {};

    level3All?.forEach(s => {
      level3ToLevel2[s.id] = s.level2_id;
    });

    level2All?.forEach(a => {
      level2ToLevel1[a.id] = a.level1_id;
    });

    // Count per level3 (specialty)
    const level3Counts = {};
    const level4Counts = {};

    pubAssignments?.forEach(a => {
      level3Counts[a.level3_id] = (level3Counts[a.level3_id] || 0) + 1;
      if (a.level4_id) {
        level4Counts[a.level4_id] = (level4Counts[a.level4_id] || 0) + 1;
      }
    });

    // Aggregate up to level2 and level1
    const level2Counts = {};
    const level1Counts = {};

    Object.entries(level3Counts).forEach(([level3Id, count]) => {
      const level2Id = level3ToLevel2[level3Id];
      if (level2Id) {
        level2Counts[level2Id] = (level2Counts[level2Id] || 0) + count;
        const level1Id = level2ToLevel1[level2Id];
        if (level1Id) {
          level1Counts[level1Id] = (level1Counts[level1Id] || 0) + count;
        }
      }
    });

    console.log('\n=== Calculated Course Counts ===');
    console.log('Level1 counts:', JSON.stringify(level1Counts, null, 2));
    console.log('Level2 counts:', JSON.stringify(level2Counts, null, 2));
    console.log('\nLevel3 counts (IDs with courses):');
    Object.entries(level3Counts).forEach(([id, count]) => {
      const level3 = level3All?.find(l => l.id === Number(id));
      console.log(`  - level3_id ${id} (${level3?.label_de || 'unknown'}): ${count} courses`);
    });

    // Check specifically for level2_id = 8 (Freizeit & Natur)
    console.log('\n=== Check: Level2 id=8 (Freizeit & Natur) ===');
    console.log('Count for level2_id 8:', level2Counts[8] || level2Counts['8'] || 0);

    // Check level3s under level2=8
    const level3sUnder8 = level3All?.filter(l => l.level2_id === 8);
    console.log('Level3s under level2=8:');
    level3sUnder8?.forEach(l => {
      console.log(`  - ${l.id} (${l.label_de}): ${level3Counts[l.id] || 0} courses`);
    });
  }

  console.log('\n=== Debug Complete ===');
}

debugCategoryData().catch(console.error);
