param(
  [string]$NaicsUrl = "https://www.census.gov/naics/2022NAICS/2022_NAICS_Structure.xlsx",
  [string]$EcfrDate = "current",
  [string]$OutDir = ".natt/resources"
)

$ErrorActionPreference = "Stop"

function New-CleanDirectory {
  param([string]$Path)
  if (Test-Path $Path) {
    Remove-Item -Recurse -Force $Path
  }
  New-Item -ItemType Directory -Path $Path | Out-Null
}

function Get-CellReferenceColumn {
  param([string]$Reference)
  return ($Reference -replace "\d", "")
}

function Get-XlsxSharedStrings {
  param([string]$ExtractedWorkbookPath)

  $sharedPath = Join-Path $ExtractedWorkbookPath "xl/sharedStrings.xml"
  if (!(Test-Path $sharedPath)) {
    return @()
  }

  [xml]$shared = Get-Content -Raw $sharedPath
  $ns = New-Object System.Xml.XmlNamespaceManager($shared.NameTable)
  $ns.AddNamespace("d", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")

  $strings = @()
  foreach ($si in $shared.SelectNodes("//d:si", $ns)) {
    $parts = @()
    foreach ($t in $si.SelectNodes(".//d:t", $ns)) {
      $parts += $t.InnerText
    }
    $strings += ($parts -join "")
  }

  return $strings
}

function Get-XlsxRows {
  param([string]$ExtractedWorkbookPath)

  $sharedStrings = Get-XlsxSharedStrings $ExtractedWorkbookPath
  [xml]$sheet = Get-Content -Raw (Join-Path $ExtractedWorkbookPath "xl/worksheets/sheet1.xml")
  $ns = New-Object System.Xml.XmlNamespaceManager($sheet.NameTable)
  $ns.AddNamespace("d", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")

  $rows = @()
  foreach ($row in $sheet.SelectNodes("//d:sheetData/d:row", $ns)) {
    $cells = @{}
    foreach ($cell in $row.SelectNodes("d:c", $ns)) {
      $valueNode = $cell.SelectSingleNode("d:v", $ns)
      if ($null -eq $valueNode) {
        continue
      }

      $value = $valueNode.InnerText
      if ($cell.t -eq "s") {
        $value = $sharedStrings[[int]$value]
      }

      $cells[(Get-CellReferenceColumn $cell.r)] = $value
    }
    $rows += $cells
  }

  return $rows
}

function Get-NaicsLevel {
  param([string]$Code)
  if ($Code -match "-") { return "sector-range" }
  switch ($Code.Length) {
    2 { return "sector" }
    3 { return "subsector" }
    4 { return "industry-group" }
    5 { return "naics-industry" }
    6 { return "national-industry" }
    default { return "unknown" }
  }
}

function Get-PlainHeading {
  param([string]$Value)
  return (($Value -replace "\s+", " ").Trim())
}

$repoRoot = Resolve-Path "."
$resourceDir = Join-Path $repoRoot $OutDir
New-Item -ItemType Directory -Force -Path $resourceDir | Out-Null

$workDir = Join-Path $env:TEMP ("devbot-procurement-regulatory-" + [guid]::NewGuid().ToString("N"))
New-CleanDirectory $workDir

try {
  Add-Type -AssemblyName System.IO.Compression.FileSystem

  $naicsXlsx = Join-Path $workDir "naics-2022.xlsx"
  Invoke-WebRequest -Uri $NaicsUrl -OutFile $naicsXlsx

  $naicsExtracted = Join-Path $workDir "naics-xlsx"
  [System.IO.Compression.ZipFile]::ExtractToDirectory($naicsXlsx, $naicsExtracted)
  $rows = Get-XlsxRows $naicsExtracted

  $codes = @()
  foreach ($row in $rows) {
    $code = [string]$row["B"]
    $title = [string]$row["C"]
    if ([string]::IsNullOrWhiteSpace($code) -or [string]::IsNullOrWhiteSpace($title)) {
      continue
    }
    if ($code -notmatch "^\d{2,6}(-\d{2})?$") {
      continue
    }

    $cleanTitle = $title.Trim()
    $isTrilateral = $cleanTitle.EndsWith("T")
    if ($isTrilateral) {
      $cleanTitle = $cleanTitle.Substring(0, $cleanTitle.Length - 1).Trim()
    }

    $sectorCode = if ($code -match "-") { $code } elseif ($code.Length -ge 2) { $code.Substring(0, 2) } else { $code }

    $codes += [ordered]@{
      code = $code
      title = $cleanTitle
      level = Get-NaicsLevel $code
      changeIndicator = ([string]$row["A"]).Trim()
      sectorCode = $sectorCode
      isTrilateral = $isTrilateral
    }
  }

  $naicsPayload = [ordered]@{
    schema = "devbot.naics.2022.v1"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    source = [ordered]@{
      name = "U.S. Census Bureau 2022 NAICS Structure with Change Indicator"
      url = $NaicsUrl
      official = $true
      notes = @(
        "NAICS is the official industry classification system used by Federal statistical agencies.",
        "Six-digit rows are national industries; shorter rows are hierarchy levels."
      )
    }
    count = $codes.Count
    codes = $codes
  }

  $naicsPayload | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 (Join-Path $resourceDir "naics-2022-codes.json")

  $dateForEcfr = $EcfrDate
  if ($EcfrDate -eq "current") {
    $structureUrl = "https://www.ecfr.gov/api/versioner/v1/structure/current/title-48.json"
    $structure = Invoke-RestMethod -Uri $structureUrl
    $dateForEcfr = if ($structure.date) { $structure.date } else { (Get-Date).AddDays(-1).ToString("yyyy-MM-dd") }
  }

  $farUrl = "https://www.ecfr.gov/api/versioner/v1/full/$dateForEcfr/title-48.xml?chapter=1"
  $farXmlPath = Join-Path $workDir "far-title48-chapter1.xml"
  Invoke-WebRequest -Uri $farUrl -OutFile $farXmlPath
  [xml]$farDoc = Get-Content -Raw $farXmlPath

  $chapter = $farDoc.SelectSingleNode("//*[@TYPE='CHAPTER' and @N='1']")
  if ($null -eq $chapter) {
    throw "Could not locate Title 48 Chapter 1 in eCFR XML."
  }

  $parts = @()
  foreach ($part in $chapter.SelectNodes(".//*[@TYPE='PART']")) {
    $head = Get-PlainHeading $part.SelectSingleNode("HEAD").InnerText
    $partNumber = [string]$part.N
    $sectionCount = $part.SelectNodes(".//*[@TYPE='SECTION']").Count
    $parts += [ordered]@{
      part = $partNumber
      heading = $head
      title = $head
      sectionCount = $sectionCount
      acquisitionGovUrl = if ($partNumber -match "^\d+$") { "https://www.acquisition.gov/far/part-$partNumber" } else { "https://www.acquisition.gov/browse/index/far" }
      ecfrUrl = "https://www.ecfr.gov/current/title-48/chapter-1/part-$partNumber"
    }
  }

  $sections = @()
  foreach ($section in $chapter.SelectNodes(".//*[@TYPE='SECTION']")) {
    $head = Get-PlainHeading $section.SelectSingleNode("HEAD").InnerText
    $citation = [string]$section.N
    $ancestorPart = $section
    while ($ancestorPart -ne $null -and $ancestorPart.TYPE -ne "PART") {
      $ancestorPart = $ancestorPart.ParentNode
    }
    $partNumber = if ($ancestorPart -ne $null) { [string]$ancestorPart.N } else { ($citation -split "\.")[0] }
    $partTitle = if ($ancestorPart -ne $null) { Get-PlainHeading $ancestorPart.SelectSingleNode("HEAD").InnerText } else { "" }

    $ancestorSubpart = $section
    while ($ancestorSubpart -ne $null -and $ancestorSubpart.TYPE -ne "SUBPART") {
      $ancestorSubpart = $ancestorSubpart.ParentNode
    }

    $sections += [ordered]@{
      citation = $citation
      heading = $head
      part = $partNumber
      partHeading = $partTitle
      subpart = if ($ancestorSubpart -ne $null) { [string]$ancestorSubpart.N } else { $null }
      subpartHeading = if ($ancestorSubpart -ne $null) { Get-PlainHeading $ancestorSubpart.SelectSingleNode("HEAD").InnerText } else { $null }
      acquisitionGovUrl = "https://www.acquisition.gov/far/$citation"
      ecfrUrl = "https://www.ecfr.gov/current/title-48/chapter-1/section-$citation"
    }
  }

  $farPayload = [ordered]@{
    schema = "devbot.far.title48.chapter1.index.v1"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    source = [ordered]@{
      name = "eCFR Title 48 Chapter 1 - Federal Acquisition Regulation"
      url = $farUrl
      ecfrDate = $dateForEcfr
      official = $true
      legalStatusNote = "The eCFR is continuously updated online but is not the official legal edition. Use official CFR/Federal Register/acquisition authority for final legal reliance."
      acquisitionGovBrowseUrl = "https://www.acquisition.gov/browse/index/far"
      acquisitionGovDevelopersUrl = "https://www.acquisition.gov/content/developers-page"
    }
    counts = [ordered]@{
      parts = $parts.Count
      sections = $sections.Count
    }
    parts = $parts
    sections = $sections
  }

  $farPayload | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 (Join-Path $resourceDir "far-title48-chapter1-index.json")

  Write-Output "Generated NAICS codes: $($codes.Count)"
  Write-Output "Generated FAR Chapter 1 parts: $($parts.Count)"
  Write-Output "Generated FAR Chapter 1 sections: $($sections.Count)"
}
finally {
  Remove-Item -Recurse -Force $workDir -ErrorAction SilentlyContinue
}
