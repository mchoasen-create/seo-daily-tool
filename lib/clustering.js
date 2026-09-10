// Keyword Clustering & LSI Expansion Module for SEO Daily Tool

const lsiDatabase = {
  'phèn': [
    'lọc nước phèn gia đình',
    'giá cột lọc nước phèn composite',
    'xử lý nước giếng khoan bị phèn sắt mangan',
    'vật liệu lọc nước nhiễm phèn nặng',
    'hệ thống lọc nước phèn 3 cột inox 304',
    'cách làm bể lọc nước phèn thủ công'
  ],
  'công nghiệp': [
    'hệ thống lọc nước công nghiệp 1000l/h',
    'máy lọc nước ro công nghiệp nhà xưởng',
    'dây chuyền lọc nước đóng bình tinh khiết',
    'báo giá hệ thống lọc nước công nghiệp 2000l/h',
    'bảo trì màng ro công nghiệp 4040 8040'
  ],
  'sinh hoạt': [
    'hệ thống lọc nước sinh hoạt đầu nguồn',
    'lọc nước sinh hoạt gia đình chung cư',
    'cột lọc nước sinh hoạt khử clo cặn vôi',
    'giá bộ lọc nước sinh hoạt 2 cột composite',
    'lọc nước tổng biệt thự cao cấp'
  ],
  'mặn': [
    'máy lọc nước mặn thành nước ngọt',
    'màng ro nước mặn sw30 cao áp',
    'hệ thống lọc nước lợ tưới cây sầu riêng',
    'xử lý nước mặn miền tây mùa xâm nhập mặn',
    'giá máy lọc nước mặn gia đình'
  ],
  'giếng khoan': [
    'xử lý nước giếng khoan bị vàng hôi tanh',
    'sơ đồ hệ thống lọc nước giếng khoan gia đình',
    'vật liệu lọc nước giếng khoan khử sắt mangan',
    'lắp đặt cột lọc nước giếng khoan tận nơi',
    'cách tự làm hệ thống lọc nước giếng khoan'
  ],
  'ro': [
    'máy lọc nước tinh khiết ro gia đình',
    'thay lõi lọc nước ro định kỳ tại nhà',
    'bơm áp cao máy lọc nước ro',
    'chỉ số tds nước ro đạt chuẩn bộ y tế'
  ]
};

function generateKeywordCluster(seedKeyword) {
  const clean = (seedKeyword || '').toLowerCase().trim();
  let clusters = [];

  Object.keys(lsiDatabase).forEach(key => {
    if (clean.includes(key)) {
      clusters = clusters.concat(lsiDatabase[key]);
    }
  });

  if (clusters.length === 0) {
    clusters = [
      `hướng dẫn ${clean} chi tiết 2026`,
      `giá hệ thống ${clean} chính hãng`,
      `quy trình lắp đặt ${clean} chuẩn kỹ thuật`,
      `tiêu chuẩn nước sạch sau khi qua ${clean}`,
      `đơn vị thi công ${clean} uy tín`
    ];
  }

  // Remove duplicates and return top 6 LSI keywords
  const uniqueClusters = Array.from(new Set(clusters)).slice(0, 6);
  return {
    seedKeyword: seedKeyword,
    clusterCount: uniqueClusters.length,
    lsiKeywords: uniqueClusters
  };
}

module.exports = {
  generateKeywordCluster,
  lsiDatabase
};
