// Declarações e importações originais
import { FrappeDoc, FrappeForm } from "@anygridtech/frappe-types/client/frappe/core";
import { ComplianceStatement, SerialNo } from "@anygridtech/frappe-agt-types/agt/doctype";

interface ItemDetails {
    custom_family?: string;
    custom_equipament_type?: string;
}
interface ExternalIssueCode {
    error_name?: string;
}

frappe.ui.form.on(cur_frm.doc.doctype, 'setup', async () => {
    await agt.setup.run();
});

const docPairs = [
    { doc: 'pickup_taxid', type: 'pickup_taxid_type' },
    { doc: 'delivery_taxid', type: 'delivery_taxid_type' },
    { doc: 'cust_taxid', type: 'cust_taxid_type' },
    { doc: 'inst_taxid', type: 'inst_taxid_type' },
    { doc: 'fiscal_taxid', type: '' }
];

// // Array com os nomes dos campos de telefone que receberão DDI automático
// const phoneFields = [
//     'delivery_phone',
//     'delivery_phone_alt',
//     'pickup_phone',
//     'pickup_phone_alt'
// ];

frappe.ui.form.on('Compliance Statement', {
    onload(frm: FrappeForm<ComplianceStatement>) {
        fields_listener(frm);
    },

    before_load(frm: FrappeForm<ComplianceStatement>) {
        load_terms(frm);
        read_only_handler(frm);
    },

    refresh(frm: FrappeForm<ComplianceStatement>) {
        load_terms(frm);
        fields_listener(frm);

        // Verifica se o workflow está no estado avançado e força confirm_all = 1
        const isAdvancedWorkflow = frm.doc.workflow_state === agt.metadata.doctype.compliance_statement.workflow_state.growatt_preliminary_assessment.name;
        if (isAdvancedWorkflow && !frm.doc.confirm_all) {
            frappe.db.set_value(
                frm.doc.doctype,
                frm.doc.name,
                'confirm_all',
                1,
                () => {
                    frm.set_value('confirm_all', 1);
                    frm.refresh_field('confirm_all');
                }
            );
        }

        read_only_handler(frm);

        docPairs.forEach(pair => {
            agt.utils.document_id(frm, pair.doc, pair.type || undefined);
        });
    },

    // Fields logic

    cod_failure(frm: FrappeForm<ComplianceStatement>) {
        if (frm.doc.cod_failure) {
            frappe.db.get_value('External Issue Code', frm.doc.cod_failure, 'error_name', (r: ExternalIssueCode) => {
                if (r?.error_name) {
                    frm.set_value('fail_description', r.error_name);
                }
            });
        }
    },

    sn_eqp(frm: FrappeForm<ComplianceStatement>) {
        if (frm.doc.sn_eqp) {
            frappe.db.get_value('Serial No', frm.doc.sn_eqp, 'item_code', (r: SerialNo) => {
                if (r?.item_code) {
                    frm.set_value('eqp_model', r.item_code);
                    setItemDetails(frm, r.item_code);
                }
            });
        }
    },

    eqp_model(frm: FrappeForm<ComplianceStatement>) {
        if (frm.doc.eqp_model) {
            setItemDetails(frm, frm.doc.eqp_model);
        } else {
            frm.set_value('eqp_type', '');
            frm.set_value('phase', '');
            frm.set_query('cod_failure', () => ({}));
        }
    },

    state(frm: FrappeForm<ComplianceStatement>) {
        if (frm.doc.uf_of_note && frm.doc.state && frm.doc.uf_of_note !== frm.doc.state) {
            frappe.msgprint({
                title: __('Atenção'),
                message: __('A UF precisa ser a mesma da nota de compra'),
                indicator: 'orange',
            });
        }
    },

    delivery_cep(frm: FrappeForm<ComplianceStatement>) {
        agt.utils.brazil.cep.validate(frm, 'delivery_cep', 'delivery_address', 'delivery_hood', 'delivery_city', 'delivery_uf');
    },

    pickup_cep(frm: FrappeForm<ComplianceStatement>) {
        agt.utils.brazil.cep.validate(frm, 'pickup_cep', 'pickup_address', 'pickup_hood', 'pickup_city', 'pickup_uf');
    },

    pickup_phone(frm: FrappeForm<ComplianceStatement>) {
        agt.utils.brazil.phone.validate(frm, 'pickup_phone');
    },
    pickup_phone_alt(frm: FrappeForm<ComplianceStatement>) {
        agt.utils.brazil.phone.validate(frm, 'pickup_phone_alt');
    },

    delivery_phone(frm: FrappeForm<ComplianceStatement>) {
        agt.utils.brazil.phone.validate(frm, 'delivery_phone');
    },

    delivery_phone_alt(frm: FrappeForm<ComplianceStatement>) {
        agt.utils.brazil.phone.validate(frm, 'delivery_phone_alt');
    },

    confirm_all(frm: FrappeForm<ComplianceStatement>) {
        if (frm.doc.confirm_all) {
            const confirmDialog = frappe.confirm(
                'Tem certeza que deseja confirmar tudo? Após salvar o formulário, não será mais possível editar.',
                async () => {
                    frappe.db.set_value(
                        frm.doc.doctype,
                        frm.doc.name,
                        'confirm_all',
                        1,
                        async () => {
                            try {
                                console.log('Campo confirm_all atualizado com sucesso');
                                
                                await agt.utils.update_workflow_state({
                                    doctype: frm.doc.doctype,
                                    docname: frm.doc.name,
                                    workflow_state: agt.metadata.doctype.compliance_statement.workflow_state.finished.name,
                                    ignore_workflow_validation: true
                                });
                                
                                // Exibir mensagem de sucesso
                                frappe.show_alert({
                                    message: 'Formulário confirmado com sucesso!',
                                    indicator: 'green'
                                }, 5);

                                // Recarregar o formulário para garantir que todos os campos estejam atualizados
                                frm.reload_doc();
                            } catch (error) {
                                console.error('Erro ao confirmar formulário:', error);
                                frappe.msgprint({
                                    title: __('Erro'),
                                    message: __('Ocorreu um erro ao confirmar o formulário. Por favor, tente novamente.'),
                                    indicator: 'red'
                                });
                                frm.set_value('confirm_all', 0);
                            }
                        }
                    );
                },
                () => {
                    frm.set_value('confirm_all', 0);
                }
            );

            confirmDialog.set_title("Confirmar");
            confirmDialog.set_primary_action("Sim, tenho certeza.");
            confirmDialog.set_secondary_action_label("Não, ainda estou editando.");
        }
    },
    cust_taxid_type(frm: FrappeForm<ComplianceStatement>) {
        const type = frm.doc.cust_taxid_type;

        // Se o campo foi limpo, zere a tabela e atualize o campo
        if (!type) {
            frm.doc.cust_attachs = [];
            frm.refresh_field('cust_attachs');
            return;
        }

        const hasFilled = (frm.doc.cust_attachs || []).some((row: any) => row.attach);
        if (hasFilled) {
            frappe.show_alert({ message: 'Documentos já inseridos — alterações ignoradas.', indicator: 'blue' }, 5);
            return;
        }

        frm.doc.cust_attachs = [];
        frm.refresh_field('cust_attachs');

        const docType = type === 'Pessoa Física' ? 'RG' : 'Contrato Social';
        frm.add_child('cust_attachs', { attach_type: docType });

        frappe.show_alert({ message: 'Insira os documentos necessários para o instalador.', indicator: 'yellow' }, 10);
        frappe.utils.play_sound("alert");

        frm.refresh_field('cust_attachs');
    },

    inst_taxid_type(frm: FrappeForm<ComplianceStatement>) {
        const type = frm.doc.inst_taxid_type;

        if (!type) {
            frm.doc.inst_attachs = [];
            frm.refresh_field('inst_attachs');
            return;
        }

        const hasFilled = (frm.doc.inst_attachs || []).some((row: any) => row.attach);
        if (hasFilled) {
            frappe.show_alert({ message: 'Documentos já inseridos — alterações ignoradas.', indicator: 'blue' }, 5);
            return;
        }

        frm.doc.inst_attachs = [];
        frm.refresh_field('inst_attachs');

        const docType = type === 'Pessoa Física' ? 'RG' : 'Contrato Social';
        frm.add_child('inst_attachs', { attach_type: docType });

        frappe.show_alert({ message: 'Insira os documentos necessários para o instalador.', indicator: 'yellow' }, 10);
        frappe.utils.play_sound("alert");

        frm.refresh_field('inst_attachs');
    },

    validate(frm: FrappeForm<ComplianceStatement>) {
        let allValid = true;

        docPairs.forEach(pair => {
            if (frm.fields_dict[pair.doc] === undefined) {
                return; // Pule este campo
            }

            const val = (frm.doc[pair.doc as keyof FrappeDoc] as string) || '';
            if (!val) return;

            try {
                const field = frm.fields_dict[pair.doc];
                const description = field?.df?.['description'] || '';

                if (description && /inválido|incompleto/i.test(description)) {
                    const fieldLabel = field?.df?.label || pair.doc;

                    frappe.msgprint({
                        title: __('Documento Inválido'),
                        message: __(`Documento inválido no campo ${fieldLabel}. Favor corrigir antes de salvar.`),
                        indicator: 'red'
                    });

                    allValid = false;
                    console.warn(`Validação falhou para o campo ${pair.doc}: ${description}`);
                }
            } catch (e) {
                console.error(`Erro ao verificar campo ${pair.doc}:`, e);
                allValid = false;
            }
        });

        if (frm.doc.cust_taxid_type &&
            (frm.doc.cust_taxid_type === 'Pessoa Física' || frm.doc.cust_taxid_type === 'Pessoa Jurídica') &&
            !isAttached(frm, 'cust_attachs', ['attach_type', 'attach'])) {
            frappe.msgprint(__('Adicione todos os anexos do cliente antes de continuar.'));
            allValid = false;
        }

        if (frm.doc.inst_taxid_type &&
            (frm.doc.inst_taxid_type === 'Pessoa Física' || frm.doc.inst_taxid_type === 'Pessoa Jurídica') &&
            !isAttached(frm, 'inst_attachs', ['attach_type', 'attach'])) {
            frappe.msgprint(__('Adicione todos os anexos do instalador antes de continuar.'));
            allValid = false;
        }

        if (!allValid) {
            frappe.validated = false;
            frappe.throw(__('Corrija os erros antes de salvar'));
            return false;
        }
        
        return true;
    },
});

function setItemDetails(frm: FrappeForm, eqp_model: string): void {
    frappe.db.get_value('Item', eqp_model, ['custom_family', 'custom_equipament_type'], (r: ItemDetails) => {
        if (r?.custom_family) {
            frm.set_query('cod_failure', () => ({ filters: { family: r.custom_family } }));
        }
    });
}

function fields_handler(frm: FrappeForm<ComplianceStatement>) {

    /* ===========================================================
    * ===> Father Section
    * ===========================================================
    */

    const showRefFields = [
        'ref_naming_series',
        'main_customer_email',
        'main_customer_name',
        'main_eqp_model',
        'main_eqp_serial_no',
        'distributor'
    ];
    showRefFields.forEach((f) => {
        const has = !!frm.doc[f as keyof FrappeDoc];
        frm.set_df_property(f, 'hidden', has ? 0 : 1);
        frm.set_df_property(f, 'read_only', has ? 1 : 0);
    });

    /* ===========================================================
     * ===> Terms and Conditions Section
     * ===========================================================
     */

    const showAgreement = [
        'ticket_docname',
        'main_customer_email',
        'main_customer_name',
        'main_eqp_model',
        'main_eqp_serial_no',
        'distributor',
    ].every((field) => frm.doc[field]);
    frm.set_df_property('section_agreement', 'hidden', showAgreement ? 0 : 1);

    /* ===========================================================
     * ===> Customer's Data Section
     * ===========================================================
     */

    const customerTypeFields = [
        'section_cust_agreement',
        'section_cust_attachs',
        'section_inst_agreement',
        'section_inst_attachs',
        'cust_taxid_type',
        'cust_name',
        'cust_taxid',
        'cust_signature',
        'inst_taxid_type',
        'inst_name',
        'inst_taxid',
        'inst_signature',
    ];
    customerTypeFields.forEach(field => frm.set_df_property(field, 'hidden', frm.doc.check_agreement ? 0 : 1));

    const customerFields = [
        'cust_name',
        'cust_taxid',
        'cust_signature',
        'section_cust_attachs',
    ];
    customerFields.forEach(field => frm.set_df_property(field, 'hidden', frm.doc.cust_taxid_type ? 0 : 1));

    /* ===========================================================
     * ===> Installers's Data Section
     * ===========================================================
     */

    const installerFields = [
        'inst_name',
        'inst_taxid',
        'inst_signature',
        'section_inst_attachs',
    ];
    installerFields.forEach(field => frm.set_df_property(field, 'hidden', frm.doc.inst_taxid_type ? 0 : 1));

    /* ===========================================================
     * ===> Fiscal Section
     * ===========================================================
     */

    const showFiscalSection = [
        'cust_taxid_type',
        'cust_taxid',
        'cust_name',
        'cust_signature',
        'inst_taxid_type',
        'inst_taxid',
        'inst_name',
        'inst_signature',
    ].every((field) => frm.doc[field]);
    frm.set_df_property('section_fiscal', 'hidden', (showFiscalSection && isAttached(frm, 'cust_attachs', ['attach_type', 'attach']) && isAttached(frm, 'inst_attachs', ['attach_type', 'attach'])) ? 0 : 1);

    /* ===========================================================
     * ===> Delivery Section
     * ===========================================================
     */

    frm.set_df_property('section_delivery', 'hidden', (showFiscalSection && isAttached(frm, 'cust_attachs', ['attach_type', 'attach']) && isAttached(frm, 'inst_attachs', ['attach_type', 'attach'])) ? 0 : 1);


    /* ===========================================================
     * ===> Pickup Section
     * ===========================================================
     */

    frm.set_df_property('section_pickup', 'hidden', (frm.doc.delivery_allow_pickup === "Sim") ? 0 : 1);

    /* ===========================================================
     * ===> Final Confirmation Section
     * ===========================================================
     */

    let showConfirmAll = false;

    if (frm.doc.delivery_allow_pickup === "") {
        showConfirmAll = false;
    } else if (frm.doc.delivery_allow_pickup === "Não") {
        showConfirmAll = [
            'delivery_taxid_type',
            'delivery_name',
            'delivery_taxid',
            'delivery_cep',
            'delivery_uf',
            'delivery_address',
            'delivery_n',
            'delivery_hood',
            'delivery_city',
            'delivery_phone'
        ].every(field => frm.doc[field]);
    } else if (frm.doc.delivery_allow_pickup === "Sim") {
        showConfirmAll = [
            'delivery_taxid_type',
            'delivery_name',
            'delivery_taxid',
            'delivery_cep',
            'delivery_uf',
            'delivery_address',
            'delivery_n',
            'delivery_hood',
            'delivery_city',
            'delivery_phone',
            'pickup_taxid_type',
            'pickup_name',
            'pickup_cep',
            'pickup_uf',
            'pickup_phone',
            'pickup_address',
            'pickup_n',
            'pickup_hood',
            'pickup_city'
        ].every(field => frm.doc[field]);
    }

    frm.set_df_property(
        'section_confirm_all',
        'hidden',
        showConfirmAll ? 0 : 1
    );
}

function read_only_handler(frm: FrappeForm<ComplianceStatement>) {
    frm.set_df_property('check_agreement', 'read_only', frm.doc.check_agreement ? 1 : 0);
    frm.set_df_property('cust_signature', 'read_only', frm.doc.confirm_all ? 1 : 0);
    frm.set_df_property('inst_signature', 'read_only', frm.doc.confirm_all ? 1 : 0);

    // Se o workflow já avançou para o estado de avaliação preliminar,
    // garante que o campo confirm_all permaneça marcado e somente leitura
    const isAdvancedWorkflow = frm.doc.workflow_state === agt.metadata.doctype.compliance_statement.workflow_state.growatt_preliminary_assessment.name;
    if (isAdvancedWorkflow && !frm.doc.confirm_all) {
        frm.set_value('confirm_all', 1);
    }

    frm.set_df_property('confirm_all', 'read_only', (frm.doc.confirm_all && isAdvancedWorkflow) ? 1 : 0);
}

function load_terms(frm: FrappeForm<ComplianceStatement>) {
    // Remove o salvamento automático para evitar problemas
    if (typeof agt !== 'undefined' && agt.utils.form.field.is_empty(frm.doc.terms_and_conditions)) {
        frappe.db.get_value('Terms and Conditions', 'Termo Dentro de Garantia', 'terms', (r: { terms?: string }) => {
            if (r?.terms) {
                frm.set_value('terms_and_conditions', r.terms);
                agt.utils.dialog.show_debugger_alert(frm, 'Termo carregado.', 'green', 5);
            } else {
                agt.utils.dialog.show_debugger_alert(frm, 'Termo não encontrado.', 'red', 5);
            }
            frm.set_df_property('terms_and_conditions', 'read_only', 1);
            frm.refresh_field('terms_and_conditions');
            // frm.dirty();
            // frm.save();
        });
    }
}

function fields_listener(frm: FrappeForm<ComplianceStatement>) {
    fields_handler(frm);
    Object.keys(frm.fields_dict).forEach((fn) => {
        const field = frm.fields_dict[fn];
        if (field && field.df) {
            field.df['onchange'] = () => {
                fields_handler(frm);
                docPairs.forEach(pair => {
                    if (frm.fields_dict[pair.doc] !== undefined &&
                            frm.fields_dict[pair.doc] !== null &&
                            frm.fields_dict[pair.doc]?.$input !== undefined) {
                            try {
                                agt.utils.document_id(frm, pair.doc, pair.type || undefined);
                            } catch (e) {
                                console.log(`Erro ao processar campo ${pair.doc}:`, e);
                            }
                        }
                });
            };
        }
    });
}

function isAttached(frm: FrappeForm, selectedTable: string, requiredFields: string[]): boolean {
    const rows = frm.doc[selectedTable];
    if (!rows || !rows.length) return false;
    return rows.every((row: any) =>
        requiredFields.every(field => !!row[field])
    );
}