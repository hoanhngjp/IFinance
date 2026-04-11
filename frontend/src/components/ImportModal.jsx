import React, { useState } from 'react';
import { X, Upload, FileText, Bot, Loader2, Save, Trash2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import axiosClient from '../api/axiosClient';

function parseCurrency(value) {
    if (!value) return 0;
    const str = value.toString().replace(/[^0-9]/g, '');
    return Number(str) || 0;
}

export default function ImportModal({ isOpen, onClose, onSuccess, wallets, categoriesList }) {
    const [activeTab, setActiveTab] = useState('file'); // 'file' or 'ai'
    const [pasteText, setPasteText] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    
    const [previewData, setPreviewData] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Lưu tạm danh mục để hiển thị cả Danh mục cũ lẫn Danh mục mới tự động
    const [localCategories, setLocalCategories] = useState([]);
    
    // Tương tự cho Ví
    const [localWallets, setLocalWallets] = useState([]);

    if (!isOpen) return null;



    // ==========================================
    // MODULE 1: AI SMART PASTE (TEXT -> JSON)
    // ==========================================
    const handleAnalyzeText = async () => {
        if (!pasteText.trim()) {
            toast.error("Vui lòng nhập nội dung ghi chú!");
            return;
        }

        setIsAnalyzing(true);
        try {
            const res = await axiosClient.post('/ai/parse', { text: pasteText });
            if (res.data?.transactions) {
                // Prepare exactly for preview
                const mapped = res.data.transactions.map((tx, index) => ({
                    _rowId: index,
                    amount: tx.amount,
                    transaction_type: tx.transaction_type || 'expense',
                    category_id: tx.category_id || categoriesList[0]?.id,
                    wallet_id: tx.wallet_id || wallets[0]?.wallet_id,
                    date: tx.date || new Date().toISOString().split('T')[0],
                    note: tx.note || ''
                }));
                setPreviewData(mapped);
                toast.success("AI đã bóc tách thành công!");
            }
        } catch (error) {
            toast.error("Lỗi AI: " + (error.response?.data?.detail || error.message));
        } finally {
            setIsAnalyzing(false);
        }
    };

    // ==========================================
    // MODULE 2: FILE UPLOAD (EXCEL/CSV -> JSON)
    // ==========================================
    const processFileHeuristics = (jsonData) => {
         if (!jsonData || jsonData.length === 0) {
             toast.error("File trống hoặc không có dữ liệu vầ dòng tiêu đề (Header).");
             return;
         }

         // Lấy dòng đầu tiên để phân tích Header
         const sampleRow = jsonData[0];
         const headers = Object.keys(sampleRow);
         
         const detectKey = (keywords) => {
             return headers.find(h => keywords.some(kw => h.toLowerCase().includes(kw)));
         };

         // Áp dụng thuật toán Heuristic tìm các cột chuẩn
         const amountKey = detectKey(['tiền', 'amount', 'giá trị', 'vnd']);
         const dateKey = detectKey(['ngày', 'date', 'thời gian', 'time']);
         const catKey = detectKey(['danh mục', 'loại', 'category', 'nhóm']);
         const noteKey = detectKey(['nội dung', 'ghi chú', 'mô tả', 'note', 'diễn giải', 'chi tiết']);
         const walletKey = detectKey(['phương thức', 'thanh toán', 'nguồn', 'ví', 'tài khoản']);
         const creditorKey = detectKey(['người nợ', 'người', 'chủ nợ', 'ghi chú/người', 'chủ', 'vay']);

         if (!amountKey) {
             toast.error("Không tìm thấy cột Số tiền. Hãy chắc chắn tên cột có chữ 'tiền' hoặc 'amount'.");
             return;
         }

         // Map Dictionary cho Category để Auto-detect ID
         const catDict = {};
         categoriesList.forEach(c => {
             catDict[c.name.toLowerCase()] = { id: c.id, type: c.type };
         });
         const defaultWalletId = wallets[0]?.wallet_id;
         
         const walletDict = {};
         wallets.forEach(w => {
             walletDict[w.name.toLowerCase()] = w.wallet_id;
         });

         const mappedData = jsonData.map((row, index) => {
              // 1. Phân tích Số tiền
              const rawAmount = row[amountKey];
              const parsedAmount = parseCurrency(rawAmount);

              // 2. Phân tích Danh mục & Type
              const rawCat = row[catKey] ? String(row[catKey]).trim() : '';
              let resolvedCatId = null;
              let resolvedType = 'expense';

              // Thử Fuzzy match vào danh mục có sẵn
              for (const [catName, catInfo] of Object.entries(catDict)) {
                  if (rawCat.toLowerCase().includes(catName) || catName.includes(rawCat.toLowerCase())) {
                      resolvedCatId = catInfo.id;
                      resolvedType = catInfo.type;
                      break;
                  }
              }

              // 2.5 Phân tích Nguồn tiền (Wallet)
              const rawWallet = (walletKey && row[walletKey]) ? String(row[walletKey]).trim() : '';
              let resolvedWalletId = null;
              
              if (rawWallet) {
                  for (const [wName, wId] of Object.entries(walletDict)) {
                      if (rawWallet.toLowerCase().includes(wName) || wName.includes(rawWallet.toLowerCase())) {
                          resolvedWalletId = wId;
                          break;
                      }
                  }
              }

              // 2.8 Phân tích Người Nợ (Creditor)
              const rawCreditor = (creditorKey && row[creditorKey]) ? String(row[creditorKey]).trim() : '';

              // 3. Phân tích Ngày
              let parsedDate = new Date().toISOString().split('T')[0];
              if (row[dateKey]) {
                  let dStr = String(row[dateKey]).trim();
                  // Regex match \d{1,2} [/\-\.] \d{1,2} [/\-\.] \d{4}
                  const dateMatch = dStr.match(/(\d{1,2})[/\\\-\.]+(\d{1,2})[/\\\-\.]+(\d{4})/);
                  if (dateMatch) {
                      const day = dateMatch[1].padStart(2, '0');
                      const month = dateMatch[2].padStart(2, '0');
                      const year = dateMatch[3];
                      parsedDate = `${year}-${month}-${day}`;
                  } else {
                      try { parsedDate = new Date(dStr).toISOString().split('T')[0]; } catch(e){}
                  }
              }

              return {
                  _rowId: index,
                  amount: parsedAmount,
                  transaction_type: resolvedType,
                  category_id: resolvedCatId,
                  wallet_id: resolvedWalletId,
                  date: parsedDate,
                  note: row[noteKey] ? String(row[noteKey]) : `Import từ dòng ${index+1}`,
                  creditor_name: rawCreditor,
                  raw_category: rawCat,
                  raw_wallet: rawWallet
              };
         });
         
         // 4. Giải quyết các Danh mục không Mapping được -> Auto sinh Danh mục mới
         let tempCats = [...(categoriesList || [])];
         let tempWallets = [...(wallets || [])];
         let nextTempId = -1;
         let nextTempWId = -1;
         
         const finalMappedData = mappedData.map(item => {
             // 4.1 Auto sinh Category
             if (item.category_id === null) {
                 const catName = item.note.split(' - ')[0] || "Khác"; // fallback
                 const actualName = item.raw_category || catName;
                 
                 // Kiểm tra nếu tên thực tế đã vừa được tạo trong tempCats chưa
                 let existingTemp = tempCats.find(c => c.name.toLowerCase() === actualName.toLowerCase());
                 if (!existingTemp) {
                     existingTemp = {
                         id: nextTempId--,
                         name: actualName,
                         type: item.transaction_type, // ngầm định
                         icon: '✨',
                         is_new: true
                     };
                     tempCats.push(existingTemp);
                 }
                 item.category_id = existingTemp.id;
                 item.transaction_type = existingTemp.type;
             }
             
             // 4.2 Auto sinh Wallet
             if (item.wallet_id === null) {
                 const wName = item.raw_wallet || "Ví Khác";
                 let existingWTemp = tempWallets.find(w => w.name.toLowerCase() === wName.toLowerCase());
                 if (!existingWTemp) {
                     existingWTemp = {
                         wallet_id: nextTempWId--,
                         name: wName,
                         type: 'bank',
                         is_new: true
                     };
                     tempWallets.push(existingWTemp);
                 }
                 item.wallet_id = existingWTemp.wallet_id;
             }
             
             return item;
         });

         setLocalCategories(tempCats);
         setLocalWallets(tempWallets);
         setPreviewData(finalMappedData.filter(item => item.amount > 0)); // Bỏ qua những dòng rỗng / số tiền = 0
         toast.success(`Đã quét thành công ${finalMappedData.length} dòng!`);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsAnalyzing(true);
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith('.csv')) {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    processFileHeuristics(results.data);
                    setIsAnalyzing(false);
                }
            });
        } else if (fileName.endsWith('.xlsx')) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const bstr = evt.target.result;
                const workbook = XLSX.read(bstr, { type: 'binary' });
                const wsname = workbook.SheetNames[0];
                const ws = workbook.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);
                processFileHeuristics(data);
                setIsAnalyzing(false);
            };
            reader.readAsBinaryString(file);
        } else {
            toast.error("Chỉ hỗ trợ file .csv hoặc .xlsx");
            setIsAnalyzing(false);
        }
    };


    // ==========================================
    // MODULE 3: LƯU HÀNG LOẠT (BULK INSERT)
    // ==========================================
    const handleUpdateRow = (rowId, field, value) => {
        setPreviewData(prevData => prevData.map(item => 
            item._rowId === rowId ? { ...item, [field]: value } : item
        ));
    };

    const handleDeleteRow = (rowId) => {
        setPreviewData(prevData => prevData.filter(item => item._rowId !== rowId));
    };

    const handleBulkInsert = async () => {
        if (!previewData || previewData.length === 0) return;

        setIsSubmitting(true);
        // Loại bỏ _rowId trước khi gửi
        const payload = previewData.map(item => {
            const { _rowId, ...rest } = item;
            // Đảm bảo kiểu dữ liệu
            rest.category_id = Number(rest.category_id);
            rest.wallet_id = Number(rest.wallet_id);
            rest.amount = Number(rest.amount);
            
            // Xử lý Danh mục mới
            const selectedCat = localCategories.find(c => c.id === rest.category_id);
            if (selectedCat && selectedCat.is_new) {
                rest.new_category_name = selectedCat.name;
            }
            
            // Xử lý Ví mới
            const selectedW = localWallets.find(w => w.wallet_id === rest.wallet_id);
            if (selectedW && selectedW.is_new) {
                rest.new_wallet_name = selectedW.name;
            }
            
            if (!rest.creditor_name) delete rest.creditor_name;
            return rest;
        });

        try {
            const res = await axiosClient.post('/transactions/bulk', payload);
            toast.success(res.message || "Nhập dữ liệu thành công!");
            setPreviewData(null);
            onSuccess(); // Triger load lại Data cha
            onClose();
        } catch (error) {
            toast.error("Lỗi Bulk Insert: " + (error.response?.data?.detail || error.message));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up relative">
                
                {/* HEADER */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Nhập liệu Hàng loạt (Bulk Import)</h2>
                        <p className="text-sm text-gray-500">Chuyển nhà siêu tốc từ Misa, MoneyLover hoặc Ghi chú Note.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                        <X size={24} />
                    </button>
                </div>

                {/* THÂN MODAL */}
                <div className="p-6 flex-1 overflow-y-auto bg-gray-50 hide-scrollbar">
                    {!previewData ? (
                        <>
                            {/* BỘ CHUYỂN TAB */}
                            <div className="flex gap-4 mb-6">
                                <button 
                                    onClick={() => setActiveTab('file')}
                                    className={`flex-1 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 border-2 transition-all ${activeTab === 'file' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-transparent text-gray-400 hover:bg-gray-100 hover:border-gray-200'}`}
                                >
                                    <FileText size={20} /> Tải lên File Mẫu (CSV/Excel)
                                </button>
                                <button 
                                    onClick={() => setActiveTab('ai')}
                                    className={`flex-1 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 border-2 transition-all ${activeTab === 'ai' ? 'bg-purple-50 border-purple-500 text-purple-700' : 'bg-white border-transparent text-gray-400 hover:bg-gray-100 hover:border-gray-200'}`}
                                >
                                    <Bot size={20} /> AI Smart Paste (Dán Text)
                                </button>
                            </div>

                            {/* VÙNG CHỨA INPUT */}
                            {activeTab === 'file' && (
                                <div className="border-2 border-dashed border-indigo-200 bg-white rounded-3xl p-12 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-indigo-50/50 transition-colors relative">
                                    <input 
                                        type="file" 
                                        accept=".csv, .xlsx" 
                                        onChange={handleFileUpload} 
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        disabled={isAnalyzing}
                                    />
                                    <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4 shadow-sm">
                                        {isAnalyzing ? <Loader2 size={36} className="animate-spin" /> : <Upload size={36} />}
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-700 mb-2">Kéo thả hoặc Nhấp để chọn File</h3>
                                    <p className="text-sm text-gray-500 max-w-md">
                                        Hỗ trợ định dạng <b>.csv</b> và <b>.xlsx</b>. Hệ thống sẽ tự động quét và phân loại cột "Tiền", "Danh mục" và nhận dạng ngày tháng.
                                    </p>
                                </div>
                            )}

                            {activeTab === 'ai' && (
                                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-4">
                                    <div className="bg-purple-50 border border-purple-100 p-4 rounded-2xl gap-3 flex items-start">
                                        <Bot className="text-purple-600 shrink-0" />
                                        <div className="text-sm text-purple-800">
                                            <b>Trí tuệ Nhân tạo Gemini</b> sẽ đọc khối văn bản của bạn và tự bóc tách thành nhiều giao dịch cùng một lúc. Rất phù hợp nếu bạn hay ghi chú chi tiêu trên Zalo. <br/>
                                            <i>VD: "Hôm qua ăn lẩu thái 300k. Đổ xăng 50k. Sáng nay mua bánh bao 15k."</i>
                                        </div>
                                    </div>
                                    <textarea
                                        value={pasteText}
                                        onChange={(e) => setPasteText(e.target.value)}
                                        placeholder="Dán hoặc gõ đoạn ghi chú của bạn vào đây..."
                                        className="w-full h-40 bg-gray-50 border border-gray-200 outline-none focus:ring-2 focus:ring-purple-500 rounded-2xl p-4 text-slate-700"
                                    ></textarea>
                                    <button 
                                        onClick={handleAnalyzeText}
                                        disabled={isAnalyzing || !pasteText}
                                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm flex justify-center items-center gap-2 disabled:opacity-50"
                                    >
                                        {isAnalyzing ? <Loader2 size={20} className="animate-spin" /> : 'Bắt đầu Phân tích AI'}
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        /* ==========================================
                           VÙNG PREVIEW DATA GRID TABLE
                           ========================================== */
                        <div className="flex flex-col h-full bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-slide-up">
                            <div className="bg-indigo-50/50 p-4 border-b border-indigo-100 flex justify-between items-center shrink-0">
                                <h3 className="font-bold text-slate-800">Bảng Đối chiếu Dữ liệu ({previewData.length} dòng)</h3>
                                <button 
                                    onClick={() => setPreviewData(null)}
                                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                                >
                                    Tải lại file khác
                                </button>
                            </div>
                            
                            <div className="overflow-x-auto flex-1 p-0 m-0">
                                <table className="w-full text-left text-sm whitespace-nowrap min-w-[800px]">
                                    <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold text-slate-600">Ngày</th>
                                            <th className="px-4 py-3 font-semibold text-slate-600">Loại</th>
                                            <th className="px-4 py-3 font-semibold text-slate-600">Số Tiền (VND)</th>
                                            <th className="px-4 py-3 font-semibold text-slate-600 w-48">Danh mục</th>
                                            <th className="px-4 py-3 font-semibold text-slate-600 w-32">Nguồn tiền</th>
                                            <th className="px-4 py-3 font-semibold text-slate-600 w-40">Người nợ</th>
                                            <th className="px-4 py-3 font-semibold text-slate-600 w-48">Ghi chú</th>
                                            <th className="px-4 py-3 text-center"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-slate-700">
                                        {previewData.map((row) => (
                                            <tr key={row._rowId} className="hover:bg-indigo-50/30 transition-colors">
                                                <td className="px-4 py-2">
                                                    <input 
                                                        type="date" 
                                                        value={row.date} 
                                                        onChange={(e) => handleUpdateRow(row._rowId, 'date', e.target.value)}
                                                        className="bg-transparent border border-transparent focus:border-gray-200 focus:bg-white rounded px-2 py-1 outline-none w-32 font-medium"
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <select 
                                                        value={row.transaction_type}
                                                        onChange={(e) => handleUpdateRow(row._rowId, 'transaction_type', e.target.value)}
                                                        className={`bg-transparent border border-transparent focus:bg-white rounded px-1 py-1 outline-none font-bold ${row.transaction_type==='income'?'text-emerald-600':'text-rose-600'}`}
                                                    >
                                                        <option value="expense">Chi phí</option>
                                                        <option value="income">Thu nhập</option>
                                                    </select>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input 
                                                        type="number" 
                                                        value={row.amount} 
                                                        onChange={(e) => handleUpdateRow(row._rowId, 'amount', e.target.value)}
                                                        className="bg-transparent border border-gray-200 bg-white shadow-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 rounded-lg px-3 py-1 outline-none w-32 font-bold text-slate-800"
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <select 
                                                        value={row.category_id}
                                                        onChange={(e) => handleUpdateRow(row._rowId, 'category_id', e.target.value)}
                                                        className="bg-gray-50 border border-gray-200 focus:border-indigo-400 rounded-lg px-2 py-1.5 outline-none w-full w-48 font-medium truncate"
                                                    >
                                                        {localCategories.filter(c => c.type === row.transaction_type).map(c => (
                                                            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <select 
                                                        value={row.wallet_id}
                                                        onChange={(e) => handleUpdateRow(row._rowId, 'wallet_id', e.target.value)}
                                                        className="bg-gray-50 border border-gray-200 focus:border-indigo-400 rounded-lg px-2 py-1.5 outline-none w-32 font-medium truncate"
                                                    >
                                                        {localWallets.map(w => (
                                                            <option key={w.wallet_id} value={w.wallet_id}>{w.is_new ? '✦ ' : ''}{w.name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input 
                                                        type="text" 
                                                        value={row.creditor_name || ''} 
                                                        onChange={(e) => handleUpdateRow(row._rowId, 'creditor_name', e.target.value)}
                                                        placeholder="Tên..."
                                                        className="bg-transparent border border-gray-200 focus:border-indigo-400 focus:bg-white rounded outline-none w-full px-2 py-1 text-sm font-semibold text-slate-800"
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <textarea 
                                                        value={row.note} 
                                                        onChange={(e) => handleUpdateRow(row._rowId, 'note', e.target.value)}
                                                        placeholder="Ghi chú nhỏ..."
                                                        rows={2}
                                                        title={row.note}
                                                        className="bg-transparent border border-transparent focus:border-gray-200 focus:bg-white rounded outline-none w-full min-w-[200px] max-w-[300px] px-2 py-1 resize-y"
                                                    />
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <button onClick={() => handleDeleteRow(row._rowId)} className="text-gray-400 hover:text-rose-500 transition-colors p-1 rounded hover:bg-rose-50">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* FOOTER NÚT BẤM (CHỈ CHỚ KHI CÓ DATA) */}
                {previewData && previewData.length > 0 && (
                    <div className="p-5 border-t border-gray-100 bg-white flex justify-end shrink-0 gap-3">
                         <button onClick={() => setPreviewData(null)} disabled={isSubmitting} className="px-5 py-3 rounded-xl font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">
                            Hủy bỏ
                         </button>
                         <button 
                             onClick={handleBulkInsert} 
                             disabled={isSubmitting} 
                             className="px-8 py-3 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors flex items-center gap-2 disabled:opacity-75"
                         >
                             {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />} 
                             Lưu {previewData.length} Giao dịch
                         </button>
                    </div>
                )}
            </div>
        </div>
    );
}
