/**
 * 按 AWS 服务类型将术语分到类别（词库 JSON 无 category 时使用）
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  存储: [
    'S3', 'EBS', 'EFS', 'Glacier', 'Storage Gateway', 'DataSync', 'Snowball',
    'FSx', '多部分上传', '传输加速', '跨区域复制', '生命周期', '版本控制',
    '快照', '卷', '桶', '对象',
  ],
  计算: [
    'EC2', 'Lambda', 'ECS', 'EKS', 'Fargate', 'Batch', 'Elastic Beanstalk',
    'Outposts', '实例', '函数', '容器', 'Serverless',
  ],
  网络: [
    'VPC', 'CloudFront', 'Route 53', 'API Gateway', 'ALB', 'NLB', 'ELB',
    'Direct Connect', 'VPN', 'Endpoint', '对等连接', '子网', '路由表',
    'NAT', '负载均衡', 'CDN', 'DNS',
  ],
  数据库: [
    'RDS', 'DynamoDB', 'ElastiCache', 'Aurora', 'Redshift', 'Neptune',
    'DocumentDB', 'MemoryDB', 'QLDB', 'Timestream', '键值', '关系型',
  ],
  安全与身份: [
    'IAM', 'KMS', 'Cognito', 'Secrets Manager', 'Certificate Manager',
    'WAF', 'Shield', 'GuardDuty', 'Inspector', 'CloudTrail', 'CloudWatch',
    '授权', '加密', '密钥', '审计', '防火墙',
  ],
  分析与大数据: [
    'Athena', 'EMR', 'Glue', 'QuickSight', 'Kinesis', 'MSK', 'Lake Formation',
    'ETL', '数据湖', '流式', '分析',
  ],
  应用集成: [
    'SQS', 'SNS', 'EventBridge', 'Step Functions', 'AppSync', 'MQ',
    '消息', '队列', '事件', '工作流',
  ],
};

const CATEGORY_ORDER = [
  '存储', '计算', '网络', '数据库', '安全与身份', '分析与大数据', '应用集成', '其他',
];

export function getCategoryForTerm(termKey: string): string {
  const upper = termKey.toUpperCase();
  const lower = termKey.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (upper.includes(kw.toUpperCase()) || lower.includes(kw.toLowerCase())) {
        return category;
      }
    }
  }
  return '其他';
}

export function getCategoryOrder(): string[] {
  return CATEGORY_ORDER;
}

export function groupTermsByCategory(termKeys: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const key of termKeys) {
    const cat = getCategoryForTerm(key);
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(key);
  }
  for (const cat of Object.keys(groups)) {
    groups[cat].sort((a, b) => a.localeCompare(b));
  }
  return groups;
}
