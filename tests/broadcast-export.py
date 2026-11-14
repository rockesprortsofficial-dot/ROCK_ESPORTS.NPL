import os,zipfile,xml.etree.ElementTree as ET
path=os.environ.get('BROADCAST_EXPORT_TEST_FILE','../broadcast-export-validation.xlsx')
ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(path) as z:
    assert z.testzip() is None
    for name in z.namelist(): ET.fromstring(z.read(name))
    teams=ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    players=ET.fromstring(z.read('xl/worksheets/sheet2.xml'))
    assert len(teams.findall('.//s:row',ns))==17
    assert len(players.findall('.//s:row',ns))==65
    assert teams.find('.//s:c[@r="B2"]/s:is/s:t',ns).text=='नेपाली & <ROCK>'
    assert teams.find('.//s:c[@r="F2"]/s:v',ns).text=='14'
    cell=players.find('.//s:c[@r="C2"]',ns)
    assert cell.attrib['t']=='inlineStr' and cell.find('s:is/s:t',ns).text=='=SUM(1,2)'
    assert players.find('.//s:f',ns) is None
print('PASS: XLSX ZIP/CRC and all XML validated, 16 teams/64 players, points, Unicode escaping, formula-like names remain plain text')
