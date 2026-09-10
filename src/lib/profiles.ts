import type { Profile } from './types';
const specialties = [
  { title: 'Backend Engineer', skills: ['Python', 'PostgreSQL', 'FastAPI', 'Docker'], work: 'Built Python services with FastAPI and PostgreSQL, with integration tests and production monitoring.' },
  { title: 'Data Engineer', skills: ['Python', 'SQL', 'Spark', 'Airflow'], work: 'Built data pipelines in Python and Spark. Scheduled incremental ETL jobs with Airflow and validated outputs using SQL.' },
  { title: 'Frontend Engineer', skills: ['TypeScript', 'React', 'Next.js', 'CSS'], work: 'Shipped accessible React and Next.js interfaces in TypeScript, with responsive CSS and keyboard navigation.' },
  { title: 'Platform Engineer', skills: ['Go', 'Kubernetes', 'Terraform', 'AWS'], work: 'Operated Go services on Kubernetes. Provisioned AWS infrastructure through Terraform with rollback procedures.' },
  { title: 'Machine Learning Engineer', skills: ['Python', 'PyTorch', 'ML', 'FastAPI'], work: 'Trained PyTorch models for machine learning and served predictions through Python and FastAPI endpoints.' },
  { title: 'Search Engineer', skills: ['Java', 'OpenSearch', 'SQL', 'Search'], work: 'Tuned OpenSearch retrieval and search ranking for a document catalog. Built Java indexing jobs and SQL quality reports.' },
  { title: 'Full Stack Engineer', skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'], work: 'Owned a React application and Node.js API in TypeScript, backed by PostgreSQL and automated release checks.' },
  { title: 'Streaming Data Engineer', skills: ['Python', 'Kafka', 'Spark', 'SQL'], work: 'Built Python data pipelines for event streaming with Kafka and Spark; handled late events and SQL reconciliation.' },
  { title: 'Mobile Engineer', skills: ['Swift', 'Kotlin', 'iOS', 'Android'], work: 'Shipped native iOS applications in Swift and Android features in Kotlin with offline synchronization.' },
  { title: 'Infrastructure Engineer', skills: ['Python', 'AWS', 'Terraform', 'Docker'], work: 'Automated AWS infrastructure using Python and Terraform. Built reproducible Docker environments and incident runbooks.' },
  { title: 'Analytics Engineer', skills: ['SQL', 'dbt', 'Snowflake', 'Python'], work: 'Modeled data in Snowflake with dbt and SQL. Added Python checks for data quality and freshness.' },
  { title: 'AI Product Engineer', skills: ['TypeScript', 'Python', 'LLM', 'React'], work: 'Built an LLM assistant with source citations, evaluated generated answers, and shipped a React review interface in TypeScript.' },
];
const first = ['Maya', 'Alex', 'Jordan', 'Sam', 'Riley', 'Morgan', 'Casey', 'Taylor', 'Avery', 'Robin', 'Jamie', 'Quinn', 'Drew', 'Cameron', 'Sage', 'Reese', 'Emery', 'Blair', 'Rowan', 'Skyler', 'Noor', 'Elliot', 'Remy', 'Jules', 'Adrian', 'Ellis', 'Finley', 'Charlie', 'River', 'Dakota'];
const last = ['Chen', 'Patel', 'Rivera', 'Kim', 'Morgan', 'Park', 'Reed', 'Singh', 'Brooks', 'Ali', 'Torres', 'Lee'];
const companies = ['Orbit Labs', 'Northstar Data', 'Cobalt Systems', 'Relay Studio', 'Meridian Cloud', 'Vector Works'];
const locations = ['San Francisco, CA', 'New York, NY', 'Austin, TX', 'Seattle, WA', 'Boston, MA', 'Chicago, IL'];
const extras = [
  { skills: ['Kafka', 'Streaming'], text: 'Implemented event streaming with Kafka, including retry handling and dead-letter queues.' },
  { skills: ['AWS', 'SQS'], text: 'Integrated AWS SQS for asynchronous job processing with idempotent consumers.' },
  { skills: ['Redis', 'Performance'], text: 'Added Redis caching and measured request latency under load to improve performance.' },
  { skills: ['Testing', 'CI/CD'], text: 'Created integration testing and CI/CD checks to catch regressions before releases.' },
  { skills: ['OpenSearch', 'Search'], text: 'Added OpenSearch keyword search, index mappings, and relevance evaluation.' },
];
export const profiles: Profile[] = Array.from({ length: 360 }, (_, i) => {
  const specialty = specialties[i % specialties.length];
  const extra = extras[Math.floor(i / specialties.length) % extras.length];
  const years = 1 + ((i * 7 + Math.floor(i / 12)) % 12);
  return { id: `tl-${String(i + 1).padStart(3, '0')}`, name: `${first[Math.floor(i / 12)]} ${last[i % 12]}`, title: specialty.title, company: companies[(i + Math.floor(i / 12)) % 6], location: locations[Math.floor(i / 12) % 6], years, skills: [...new Set([...specialty.skills, ...extra.skills])], summary: `${specialty.title} with ${years} years of professional experience, focused on reliable products and maintainable systems.`, experience: [specialty.work, extra.text, `Collaborated with product and design on a ${['developer portal', 'internal dashboard', 'customer workspace', 'reporting service'][Math.floor(i / 60) % 4]}, documenting technical decisions and incorporating user feedback.`], source: `Synthetic résumé ${String(i + 1).padStart(3, '0')}` };
});
export const skillCatalog = [...new Set(profiles.flatMap(p => p.skills))].sort();
export const defaultQuery = 'Backend engineers with Python and data pipeline experience';
