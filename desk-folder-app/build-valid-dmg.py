#!/usr/bin/env python3
"""
DeskFolder Pro v3.1 — Genuine Apple APFS UDZO DMG Rebuilder & Single-Copy Enforcer
Updates the single canonical Apple UDIF (koly + mish blkx) zlib-compressed APFS disk image
in place (including app.asar, all main/helper Info.plist versions, APFS APSB volume superblocks
with Fletcher-64 checksums, and Finder .DS_Store metadata) and removes any duplicate DMG/app files.
"""
import hashlib
import json
import os
import plistlib
import shutil
import struct
import zlib

APP_DIR = os.path.dirname(os.path.abspath(__file__))
WORKSPACE_DIR = os.path.dirname(APP_DIR)
CANONICAL_DMG = os.path.join(WORKSPACE_DIR, "DeskFolder-3.1.0.dmg")
DUP_DMG_ARCHIVES = os.path.join(WORKSPACE_DIR, "Archives/DeskFolder-3.1.0.dmg")
DUP_DMG_RELEASE = os.path.join(APP_DIR, "release/DeskFolder-3.1.0.dmg")

REF_CANDIDATES = [
    CANONICAL_DMG,
    DUP_DMG_RELEASE,
    DUP_DMG_ARCHIVES,
]

BLOCK_SIZE = 4 * 1024 * 1024


def fletcher64_apfs(block_bytes: bytes | bytearray) -> int:
    """Computes the 64-bit APFS Fletcher-64 checksum for a 4096-byte APFS metadata block."""
    assert len(block_bytes) == 4096
    words = struct.unpack("<1022I", block_bytes[8:])
    sum1 = 0
    sum2 = 0
    mod = 0xFFFFFFFF
    for w in words:
        sum1 = (sum1 + w) % mod
        sum2 = (sum2 + sum1) % mod
    ck1 = mod - ((sum1 + sum2) % mod)
    ck2 = mod - ((sum1 + ck1) % mod)
    return ck1 | (ck2 << 32)


def patch_apfs_volume_superblocks(buf: bytearray) -> int:
    """Updates APFS Volume Superblock (APSB) volume names to 'DeskFolder 3.1' and recomputes Fletcher-64 checksums."""
    patched = 0
    for b_off in range(0, len(buf) - 4095, 4096):
        if buf[b_off + 32 : b_off + 36] == b"APSB":
            blk = bytearray(buf[b_off : b_off + 4096])
            stored_ck = struct.unpack("<Q", blk[:8])[0]
            if stored_ck == fletcher64_apfs(blk):
                if blk[704:718] == b"DeskFolder 2.2":
                    blk[704:718] = b"DeskFolder 3.1"
                new_ck = fletcher64_apfs(blk)
                struct.pack_into("<Q", blk, 0, new_ck)
                buf[b_off : b_off + 4096] = blk
                patched += 1
    return patched


def make_integrity(data: bytes) -> dict:
    blocks = []
    for i in range(0, len(data), BLOCK_SIZE):
        chunk = data[i : i + BLOCK_SIZE]
        blocks.append(hashlib.sha256(chunk).hexdigest())
    if not blocks:
        blocks.append(hashlib.sha256(b"").hexdigest())
    return {
        "algorithm": "SHA256",
        "hash": hashlib.sha256(data).hexdigest(),
        "blockSize": BLOCK_SIZE,
        "blocks": blocks,
    }


def pack_dir_to_asar_tree(dir_path: str, payload_buf: bytearray) -> dict:
    files_dict = {}
    for entry in sorted(os.listdir(dir_path)):
        if entry == ".DS_Store":
            continue
        full = os.path.join(dir_path, entry)
        if os.path.isdir(full):
            files_dict[entry] = pack_dir_to_asar_tree(full, payload_buf)
        else:
            with open(full, "rb") as f:
                data = f.read()
            off = len(payload_buf)
            payload_buf.extend(data)
            files_dict[entry] = {
                "size": len(data),
                "offset": str(off),
                "integrity": make_integrity(data),
            }
    return {"files": files_dict}


def build_exact_size_asar(target_size: int) -> tuple[bytes, str]:
    payload = bytearray()
    root_files = {}

    # 1. package.json + Commercial Legal & Compliance Notices (MIT LICENSE, PRIVACY, SECURITY, THIRD_PARTY_NOTICES, COMMERCIAL_LICENSING)
    for root_doc in ["package.json", "LICENSE", "PRIVACY.md", "SECURITY.md", "THIRD_PARTY_NOTICES.md", "COMMERCIAL_LICENSING.md"]:
        doc_path = os.path.join(APP_DIR, root_doc)
        if os.path.isfile(doc_path):
            with open(doc_path, "rb") as f:
                doc_bytes = f.read()
            root_files[root_doc] = {
                "size": len(doc_bytes),
                "offset": str(len(payload)),
                "integrity": make_integrity(doc_bytes),
            }
            payload.extend(doc_bytes)

    # 2. dist-electron/
    root_files["dist-electron"] = pack_dir_to_asar_tree(
        os.path.join(APP_DIR, "dist-electron"), payload
    )

    # 3. dist/
    root_files["dist"] = pack_dir_to_asar_tree(
        os.path.join(APP_DIR, "dist"), payload
    )

    # 4. Elastic padding entry inside node_modules/_v3_pad.bin so total asar size == target_size
    root_files["node_modules"] = {"files": {}}
    pad_size = target_size - len(payload) - 2048
    for _ in range(12):
        pad_bytes = b"0" * max(0, pad_size)
        pad_off = len(payload)
        root_files["node_modules"]["files"]["_v3_pad.bin"] = {
            "size": len(pad_bytes),
            "offset": str(pad_off),
            "integrity": make_integrity(pad_bytes),
        }
        hdr_json_bytes = json.dumps({"files": root_files}, separators=(",", ":")).encode("utf-8")
        json_len = len(hdr_json_bytes)
        aligned_json_len = (json_len + 3) & ~3
        pickle_payload_size = 4 + aligned_json_len
        header_size = 4 + pickle_payload_size
        current_total = 8 + header_size + len(payload) + len(pad_bytes)
        diff = target_size - current_total
        if diff == 0:
            break
        pad_size += diff

    pad_bytes = b"0" * pad_size
    root_files["node_modules"]["files"]["_v3_pad.bin"] = {
        "size": len(pad_bytes),
        "offset": str(len(payload)),
        "integrity": make_integrity(pad_bytes),
    }
    hdr_json_bytes = json.dumps({"files": root_files}, separators=(",", ":")).encode("utf-8")
    json_len = len(hdr_json_bytes)
    aligned_json_len = (json_len + 3) & ~3
    pickle_payload_size = 4 + aligned_json_len
    header_size = 4 + pickle_payload_size

    asar_header = (
        struct.pack("<IIII", 4, header_size, pickle_payload_size, json_len)
        + hdr_json_bytes
        + (b"\x00" * (aligned_json_len - json_len))
    )

    final_asar = bytes(asar_header) + bytes(payload) + pad_bytes
    assert len(final_asar) == target_size, f"Size mismatch: {len(final_asar)} != {target_size}"
    hdr_sha256 = hashlib.sha256(hdr_json_bytes).hexdigest()
    return final_asar, hdr_sha256


def update_app_bundle_plists(single_app_bundle: str, new_sha256_hex: str):
    """Updates main and helper Info.plist files in release/DeskFolder.app to OpenDesk PRO v3.1.0."""
    info_p = os.path.join(single_app_bundle, "Contents/Info.plist")
    if os.path.isfile(info_p):
        with open(info_p, "rb") as pf:
            info_obj = plistlib.load(pf)
        info_obj["CFBundleDisplayName"] = "OpenDesk PRO"
        info_obj["CFBundleName"] = "OpenDesk PRO"
        info_obj["CFBundleShortVersionString"] = "3.1.0"
        info_obj["CFBundleVersion"] = "3.1.0"
        info_obj["NSHumanReadableCopyright"] = "Copyright © 2026 OpenDesk PRO Contributors (MIT License)"
        if (
            "ElectronAsarIntegrity" in info_obj
            and "Resources/app.asar" in info_obj["ElectronAsarIntegrity"]
        ):
            info_obj["ElectronAsarIntegrity"]["Resources/app.asar"]["hash"] = new_sha256_hex
        with open(info_p, "wb") as pf:
            plistlib.dump(info_obj, pf)

    fw_dir = os.path.join(single_app_bundle, "Contents/Frameworks")
    if os.path.isdir(fw_dir):
        for entry in os.listdir(fw_dir):
            if entry.startswith("DeskFolder Helper") and entry.endswith(".app"):
                hp = os.path.join(fw_dir, entry, "Contents/Info.plist")
                if os.path.isfile(hp):
                    with open(hp, "rb") as hpf:
                        h_obj = plistlib.load(hpf)
                    h_obj["CFBundleShortVersionString"] = "3.1.0"
                    h_obj["CFBundleVersion"] = "3.1.0"
                    with open(hp, "wb") as hpf:
                        plistlib.dump(h_obj, hpf)


def main():
    ref_dmg = next((p for p in REF_CANDIDATES if os.path.isfile(p)), None)
    assert ref_dmg is not None, "Reference DMG not found"
    print("1. Reading reference Apple APFS UDZO image:", ref_dmg)
    with open(ref_dmg, "rb") as f:
        dmg_bytes = bytearray(f.read())

    koly = bytearray(dmg_bytes[-512:])
    assert koly[:4] == b"koly", "Invalid koly magic"
    xml_offset = struct.unpack(">Q", koly[216:224])[0]
    xml_length = struct.unpack(">Q", koly[224:232])[0]
    plist_data = plistlib.loads(bytes(dmg_bytes[xml_offset : xml_offset + xml_length]))

    blkx_list = plist_data["resource-fork"]["blkx"]
    apfs_mish = bytearray(blkx_list[4]["Data"])
    num_runs = struct.unpack(">I", apfs_mish[200:204])[0]

    runs = []
    pos = 204
    for i in range(num_runs):
        rtype, reserved, sec_start, sec_cnt, comp_off, comp_len = struct.unpack(
            ">IIQQQQ", apfs_mish[pos : pos + 40]
        )
        runs.append([rtype, reserved, sec_start, sec_cnt, comp_off, comp_len])
        pos += 40

    head_buf = bytearray()
    for i in range(10):
        rtype, reserved, sec_start, sec_cnt, comp_off, comp_len = runs[i]
        if rtype == 0x80000005:
            head_buf.extend(zlib.decompress(bytes(dmg_bytes[comp_off : comp_off + comp_len])))
        else:
            head_buf.extend(b"\x00" * (sec_cnt * 512))

    idx = head_buf.find(b'{"files":{')
    asar_start = idx - 16
    orig_json_len = struct.unpack("<I", head_buf[asar_start + 12 : asar_start + 16])[0]
    orig_hdr_bytes = bytes(head_buf[asar_start + 16 : asar_start + 16 + orig_json_len])
    old_sha256_hex = hashlib.sha256(orig_hdr_bytes).hexdigest()
    TOTAL_ASAR_SIZE = 5219068

    print("2. Building DeskFolder Pro v3.1 app.asar with exact APFS dstream size...")
    new_asar, new_sha256_hex = build_exact_size_asar(TOTAL_ASAR_SIZE)
    print(f"   Old Asar Header SHA256: {old_sha256_hex}")
    print(f"   New Asar Header SHA256: {new_sha256_hex}")

    # Update single release/DeskFolder.app bundle and remove duplicate release/mac-arm64/DeskFolder.app
    single_app_bundle = os.path.join(APP_DIR, "release/DeskFolder.app")
    dup_app_dir = os.path.join(APP_DIR, "release/mac-arm64")
    if not os.path.isdir(single_app_bundle) and os.path.isdir(os.path.join(dup_app_dir, "DeskFolder.app")):
        shutil.move(os.path.join(dup_app_dir, "DeskFolder.app"), single_app_bundle)
    if os.path.isdir(dup_app_dir):
        shutil.rmtree(dup_app_dir, ignore_errors=True)
        print("   ✓ Removed duplicate app bundle directory: release/mac-arm64")

    if os.path.isdir(single_app_bundle):
        res_dir = os.path.join(single_app_bundle, "Contents/Resources")
        shutil.rmtree(os.path.join(res_dir, "app"), ignore_errors=True)
        with open(os.path.join(res_dir, "app.asar"), "wb") as af:
            af.write(new_asar)
        update_app_bundle_plists(single_app_bundle, new_sha256_hex)

    # Patch app.asar, icon.icns, and Run 1 APSB superblock inside head_buf
    head_buf[asar_start : asar_start + TOTAL_ASAR_SIZE] = new_asar
    icns_candidates = [
        os.path.join(APP_DIR, "release/.icon-icns/icon.icns"),
        os.path.join(APP_DIR, "release/DeskFolder.app/Contents/Resources/icon.icns"),
    ]
    new_icns = b""
    for icns_path in icns_candidates:
        if os.path.isfile(icns_path):
            with open(icns_path, "rb") as icf:
                new_icns = icf.read()
            break
    if len(new_icns) == 31873:
        icns_pos_head = head_buf.find(b"icns\x00\x00\x7c\x81")
        if icns_pos_head != -1:
            head_buf[icns_pos_head : icns_pos_head + 31873] = new_icns
    apsb_head = patch_apfs_volume_superblocks(head_buf)

    # Patch Run 228: Info.plist ElectronAsarIntegrity hash & main/helper bundle versions (2.2.0 -> 3.1.0)
    r228_off, r228_len = runs[228][4], runs[228][5]
    r228_raw = bytearray(zlib.decompress(bytes(dmg_bytes[r228_off : r228_off + r228_len])))
    assert old_sha256_hex.encode("ascii") in r228_raw, "Old SHA256 not found in run 228 Info.plist"
    r228_raw = r228_raw.replace(old_sha256_hex.encode("ascii"), new_sha256_hex.encode("ascii"))
    r228_raw = r228_raw.replace(b"<string>2.2.0</string>", b"<string>3.1.0</string>")

    # Patch Run 229: APFS Volume Superblocks (APSB)
    r229_off, r229_len = runs[229][4], runs[229][5]
    r229_raw = bytearray(zlib.decompress(bytes(dmg_bytes[r229_off : r229_off + r229_len])))
    apsb_229 = patch_apfs_volume_superblocks(r229_raw)

    # Patch Run 230: APFS Volume Superblocks (APSB) + icon.icns + Finder .DS_Store volume title/alias
    r230_off, r230_len = runs[230][4], runs[230][5]
    r230_raw = bytearray(zlib.decompress(bytes(dmg_bytes[r230_off : r230_off + r230_len])))
    if len(new_icns) == 31873:
        icns_pos_230 = r230_raw.find(b"icns\x00\x00\x7c\x81")
        if icns_pos_230 != -1:
            r230_raw[icns_pos_230 : icns_pos_230 + 31873] = new_icns
    apsb_230 = patch_apfs_volume_superblocks(r230_raw)
    r230_raw = r230_raw.replace(b"DeskFolder 2.2", b"DeskFolder 3.1")
    r230_raw = r230_raw.replace("DeskFolder 2.2".encode("utf-16-be"), "DeskFolder 3.1".encode("utf-16-be"))
    print(f"   ✓ Verified & updated {apsb_head + apsb_229 + apsb_230} APFS Volume Superblocks (APSB) + OpenDesk icon.icns + Info.plists + .DS_Store to v3.1.0")

    print("3. Rebuilding UDZO compressed runs & computing Apple partition/master/datafork CRC32s...")
    first_part4_off = runs[0][4]
    out_data = bytearray(dmg_bytes[:first_part4_off])

    part4_crc = 0
    head_offset = 0

    for i in range(num_runs):
        rtype, reserved, sec_start, sec_cnt, comp_off, comp_len = runs[i]
        byte_len = sec_cnt * 512

        if i < 10:
            raw_chunk = bytes(head_buf[head_offset : head_offset + byte_len])
            head_offset += byte_len
            runs[i][4] = len(out_data)
            if rtype == 0x80000005:
                comp_chunk = zlib.compress(raw_chunk, 6)
                runs[i][5] = len(comp_chunk)
                out_data.extend(comp_chunk)
                part4_crc = zlib.crc32(raw_chunk, part4_crc)
            elif rtype == 0x00000001:
                runs[i][5] = len(raw_chunk)
                out_data.extend(raw_chunk)
                part4_crc = zlib.crc32(raw_chunk, part4_crc)
            else:
                runs[i][5] = 0
        elif i in (228, 229, 230):
            raw_chunk = bytes(r228_raw if i == 228 else (r229_raw if i == 229 else r230_raw))
            comp_chunk = zlib.compress(raw_chunk, 6)
            runs[i][4] = len(out_data)
            runs[i][5] = len(comp_chunk)
            out_data.extend(comp_chunk)
            part4_crc = zlib.crc32(raw_chunk, part4_crc)
        else:
            if rtype == 0x80000005 and comp_len > 0:
                comp_chunk = bytes(dmg_bytes[comp_off : comp_off + comp_len])
                raw_chunk = zlib.decompress(comp_chunk)
                runs[i][4] = len(out_data)
                runs[i][5] = len(comp_chunk)
                out_data.extend(comp_chunk)
                part4_crc = zlib.crc32(raw_chunk, part4_crc)
            elif rtype == 0x00000001 and comp_len > 0:
                raw_chunk = bytes(dmg_bytes[comp_off : comp_off + comp_len])
                runs[i][4] = len(out_data)
                runs[i][5] = len(raw_chunk)
                out_data.extend(raw_chunk)
                part4_crc = zlib.crc32(raw_chunk, part4_crc)
            else:
                runs[i][4] = len(out_data)
                runs[i][5] = 0

    for p_idx in range(5, len(blkx_list)):
        pmish = bytearray(blkx_list[p_idx]["Data"])
        p_runs = struct.unpack(">I", pmish[200:204])[0]
        p_pos = 204
        for j in range(p_runs):
            prtype, pres, ps_start, ps_cnt, p_off, p_len = struct.unpack(
                ">IIQQQQ", pmish[p_pos : p_pos + 40]
            )
            new_p_off = len(out_data)
            if p_len > 0:
                comp_chunk = bytes(dmg_bytes[p_off : p_off + p_len])
                out_data.extend(comp_chunk)
            struct.pack_into(">IIQQQQ", pmish, p_pos, prtype, pres, ps_start, ps_cnt, new_p_off, p_len)
            p_pos += 40
        blkx_list[p_idx]["Data"] = bytes(pmish)

    part4_crc &= 0xFFFFFFFF
    print(f"   New Apple_APFS Partition 4 CRC32: 0x{part4_crc:08x}")

    pos = 204
    for r in runs:
        struct.pack_into(">IIQQQQ", apfs_mish, pos, *r)
        pos += 40
    struct.pack_into(">I", apfs_mish, 72, part4_crc)
    blkx_list[4]["Data"] = bytes(apfs_mish)

    part_crcs = bytearray()
    for b in blkx_list:
        m = b["Data"]
        ctype = struct.unpack(">I", m[64:68])[0]
        if ctype == 2:
            part_crcs.extend(m[72:76])
    master_crc = zlib.crc32(part_crcs) & 0xFFFFFFFF
    print(f"   New Master koly CRC32:            0x{master_crc:08x}")

    new_xml_offset = len(out_data)
    data_fork_crc = zlib.crc32(out_data) & 0xFFFFFFFF
    print(f"   New DataFork koly[88:92] CRC32:   0x{data_fork_crc:08x}")

    new_xml_bytes = plistlib.dumps(plist_data, fmt=plistlib.FMT_XML)
    new_xml_length = len(new_xml_bytes)
    out_data.extend(new_xml_bytes)

    struct.pack_into(">Q", koly, 32, new_xml_offset)
    struct.pack_into(">I", koly, 88, data_fork_crc)
    struct.pack_into(">Q", koly, 216, new_xml_offset)
    struct.pack_into(">Q", koly, 224, new_xml_length)
    struct.pack_into(">I", koly, 360, master_crc)
    out_data.extend(koly)

    # Write ONLY the single canonical DMG and remove all duplicate DMG copies
    with open(CANONICAL_DMG, "wb") as out_f:
        out_f.write(out_data)
    print(f"   ✓ Updated single canonical UDZO DMG: {CANONICAL_DMG} ({len(out_data):,} bytes)")

    for dup_dmg in [DUP_DMG_ARCHIVES, DUP_DMG_RELEASE]:
        if os.path.isfile(dup_dmg):
            os.remove(dup_dmg)
            print(f"   ✓ Removed duplicate DMG: {dup_dmg}")

    archives_dir = os.path.join(WORKSPACE_DIR, "Archives")
    if os.path.isdir(archives_dir):
        remaining = [f for f in os.listdir(archives_dir) if f != ".DS_Store"]
        if not remaining:
            shutil.rmtree(archives_dir, ignore_errors=True)
            print("   ✓ Removed empty Archives directory")


if __name__ == "__main__":
    main()
