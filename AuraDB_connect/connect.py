import os
import certifi

from neo4j import GraphDatabase

URI = "neo4j+s://985a162b.databases.neo4j.io"
AUTH = ("985a162b", "lwo7P1Y3i4Ec0LomB2rDQ-EhC2UdaGszadBkwnb0JbI")

# 使用 certifi 提供的证书解决 Windows 下 Python SSL 证书缺失问题
os.environ["SSL_CERT_FILE"] = certifi.where()

driver = GraphDatabase.driver(URI, auth=AUTH)

# 测试连接
driver.verify_connectivity()
print("连接成功")