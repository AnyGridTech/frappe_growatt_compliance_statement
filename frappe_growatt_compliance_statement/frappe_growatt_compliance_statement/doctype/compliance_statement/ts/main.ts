// Original declarations and imports
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
    { doc: 'pickup_taxid', type: 'pickup_taxid_type', name: 'pickup_name' },
    { doc: 'delivery_taxid', type: 'delivery_taxid_type', name: 'delivery_name' },
    { doc: 'cust_taxid', type: 'cust_taxid_type', name: 'cust_name' },
    { doc: 'inst_taxid', type: 'inst_taxid_type', name: 'inst_name' },
    { doc: 'fiscal_taxid', type: '', name: '' }
];

// // Array with the names of phone fields that will receive automatic DDI
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
        const isAdvancedWorkflow = frm.doc.workflow_state === agt.metadata.doctype.compliance_statement.workflow_state.finished.name;
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
            agt.utils.document_id(frm, pair.doc, pair.type || undefined, pair.name || undefined);
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
                title: __('Attention'),
                message: __('The state (UF) must be the same as the invoice state'),
                indicator: 'orange',
            });
        }
    },

    button_terms_and_conditions() {
        const url = 'https://drive.google.com/uc?export=download&id=1GiSwo6qmxlBqrlXU4s3oBzSU-uYmJf3_';
        try {
            if (window.top) {
                window.top.open(url, '_blank', 'noopener');
            } else {
                window.open(url, '_blank', 'noopener');
            }
        } catch (e) {
            window.open(url, '_blank', 'noopener');
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
                'Are you sure you want to confirm everything? After saving the form, it will no longer be possible to edit.',
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

                                // Show success message
                                frappe.show_alert({
                                    message: 'Form successfully confirmed!',
                                    indicator: 'green'
                                }, 5);

                                // Reload the form to ensure all fields are updated
                                frm.reload_doc();
                            } catch (error) {
                                console.error('Error confirming form:', error);
                                frappe.msgprint({
                                    // Reload the form to ensure all fields are updated
                                    message: __('An error occurred while confirming the form. Please try again.'),
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

            confirmDialog.set_title("Confirm");
            confirmDialog.set_primary_action("Yes, I'm sure.");
            confirmDialog.set_secondary_action_label("No, I'm still editing.");
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
            frappe.show_alert({ message: 'Documents already inserted — changes ignored.', indicator: 'blue' }, 5);
            return;
        }

        frm.doc.cust_attachs = [];
        frm.refresh_field('cust_attachs');

        const docType = type === 'Individual' ? 'RG' : 'Contrato Social';
        frm.add_child('cust_attachs', { attach_type: docType });

        frappe.show_alert({ message: 'Please insert the required documents for the installer.', indicator: 'yellow' }, 10);
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
            frappe.show_alert({ message: 'Documents already inserted — changes ignored.', indicator: 'blue' }, 5);
            return;
        }

        frm.doc.inst_attachs = [];
        frm.refresh_field('inst_attachs');

        const docType = type === 'Individual' ? 'RG' : 'Contrato Social';
        frm.add_child('inst_attachs', { attach_type: docType });

        frappe.show_alert({ message: 'Please insert the required documents for the installer.', indicator: 'yellow' }, 10);
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
                        title: __('Invalid Document'),
                        message: __(`Invalid document in field ${fieldLabel}. Please correct before saving.`),
                        indicator: 'red'
                    });

                    allValid = false;
                    console.warn(`Validation failed for field ${pair.doc}: ${description}`);
                }
            } catch (e) {
                console.error(`Error checking field ${pair.doc}:`, e);
                allValid = false;
            }
        });

        if (frm.doc.cust_taxid_type &&
            (frm.doc.cust_taxid_type === 'Individual' || frm.doc.cust_taxid_type === 'Legal Entity') &&
            !isAttached(frm, 'cust_attachs', ['attach_type', 'attach'])) {
            frappe.msgprint(__('Add all customer attachments before continuing.'));
            allValid = false;
        }

        if (frm.doc.inst_taxid_type &&
            (frm.doc.inst_taxid_type === 'Individual' || frm.doc.inst_taxid_type === 'Legal Entity') &&
            !isAttached(frm, 'inst_attachs', ['attach_type', 'attach'])) {
            frappe.msgprint(__('Add all installer attachments before continuing.'));
            allValid = false;
        }

        if (!allValid) {
            frappe.validated = false;
            frappe.throw(__('Fix the errors before saving'));
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

function setNameLabel(frm: FrappeForm, nameField: string, typeField: string) {
    const type = (frm.doc[typeField as keyof FrappeDoc] as string) || '';
    let label = 'Name';
    if (type === 'Individual') {
        label = 'Individual Name';
    } else if (type === 'Legal Entity') {
        label = 'Legal Entity Name';
    }
    try {
        frm.set_df_property(nameField, 'label', label);
    } catch (e) {
        console.warn(`Could not set label for ${nameField}:`, e);
    }
}

function fields_handler(frm: FrappeForm<ComplianceStatement>) {

    /* ===========================================================
     * ===> Reference Section
     * ===========================================================
     */

    const showRefFields = [
        'ref_naming_series'
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
        'ticket_docname'
    ].every((field) => frm.doc[field]);
    frm.set_df_property('section_agreement', 'hidden', showAgreement ? 0 : 1);

    /* ===========================================================
     * ===> Customer's Data Section
     * ===========================================================
     */

    const customerTypeFields = [
        'button_terms_and_conditions',
        'section_cust_agreement',
        'cust_taxid_type',
        'cust_name',
        'cust_taxid',
        'section_cust_attachs',
        'section_inst_agreement',
        'check_allow_installer',
        'inst_taxid_type',
        'inst_name',
        'inst_taxid',
        'section_inst_attachs',
    ];
    customerTypeFields.forEach(field => frm.set_df_property(field, 'hidden', frm.doc.check_agreement ? 0 : 1));

    // Hide signatures
    frm.set_df_property('cust_signature', 'hidden', 1);
    frm.set_df_property('inst_signature', 'hidden', 1);

    const customerFields = [
        'cust_name',
        'cust_taxid',
        'section_cust_attachs'
    ];
    customerFields.forEach(field => frm.set_df_property(field, 'hidden', frm.doc.cust_taxid_type ? 0 : 1));

    /* ===========================================================
     * ===> Installer's Data Section
     * ===========================================================
     */

    frm.set_df_property('inst_taxid_type', 'hidden', (frm.doc.check_allow_installer ? 0 : 1));

    const installerFields = [
        'inst_name',
        'inst_taxid',
        'section_inst_attachs'
    ];
    installerFields.forEach(field => frm.set_df_property(field, 'hidden', frm.doc.inst_taxid_type ? 0 : 1));

    // Atualiza os labels dos campos *_name conforme o tipo selecionado
    setNameLabel(frm, 'cust_name', 'cust_taxid_type');
    setNameLabel(frm, 'inst_name', 'inst_taxid_type');
    setNameLabel(frm, 'delivery_name', 'delivery_taxid_type');
    setNameLabel(frm, 'pickup_name', 'pickup_taxid_type');

    /* ===========================================================
     * ===> Fiscal Section
     * ===========================================================
     */

    // const showFiscalSection = [
    //     'cust_taxid_type',
    //     'cust_taxid',
    //     'cust_name',
    //     // We disabled the obligation to fill the installer signature
    //     // 'inst_taxid_type',
    //     // 'inst_taxid',
    //     // 'inst_name',
    // ].every((field) => frm.doc[field]);
    // frm.set_df_property('section_fiscal', 'hidden', (showFiscalSection && isAttached(frm, 'cust_attachs', ['attach_type', 'attach']) && isAttached(frm, 'inst_attachs', ['attach_type', 'attach'])) ? 0 : 1);

    // Determine whether the fiscal section should be shown.
    let showFiscalSection: boolean;
    let hasFiscalAttachments: boolean;

    if (!frm.doc.check_allow_installer) {
        showFiscalSection = [
            'cust_taxid_type',
            'cust_taxid',
            'cust_name'
        ].every((field) => frm.doc[field]);
        hasFiscalAttachments = isAttached(frm, 'cust_attachs', ['attach_type', 'attach']);
        frm.set_df_property('section_fiscal', 'hidden', (showFiscalSection && hasFiscalAttachments) ? 0 : 1);
    } else {
        showFiscalSection = [
            'cust_taxid_type',
            'cust_taxid',
            'cust_name',
            'inst_taxid_type',
            'inst_taxid',
            'inst_name',
        ].every((field) => frm.doc[field]);
        hasFiscalAttachments = isAttached(frm, 'cust_attachs', ['attach_type', 'attach']) && isAttached(frm, 'inst_attachs', ['attach_type', 'attach']);
        frm.set_df_property('section_fiscal', 'hidden', (showFiscalSection && hasFiscalAttachments) ? 0 : 1);
    }

    /* ===========================================================
     * ===> Delivery Section
     * ===========================================================
     */

    // Use the computed fiscalAttached flag to decide delivery section visibility
    frm.set_df_property('section_delivery', 'hidden', (showFiscalSection && hasFiscalAttachments) ? 0 : 1);


    /* ===========================================================
     * ===> Pickup Section
     * ===========================================================
     */

    frm.set_df_property('section_pickup', 'hidden', (frm.doc.delivery_allow_pickup === "Yes") ? 0 : 1);

    /* ===========================================================
     * ===> Final Confirmation Section
     * ===========================================================
     */

    let showConfirmAll = false;

    if (frm.doc.delivery_allow_pickup === "") {
        showConfirmAll = false;
    } else if (frm.doc.delivery_allow_pickup === "No") {
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
    } else if (frm.doc.delivery_allow_pickup === "Yes") {
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

    // If the workflow has already advanced to the preliminary evaluation state,
    // ensures that the confirm_all field remains checked and read-only
    const isAdvancedWorkflow = frm.doc.workflow_state === agt.metadata.doctype.compliance_statement.workflow_state.finished.name;
    if (isAdvancedWorkflow && !frm.doc.confirm_all) {
        frm.set_value('confirm_all', 1);
    }

    frm.set_df_property('button_terms_and_conditions', 'hidden', (isAdvancedWorkflow) ? 1 : 0);
    frm.set_df_property('confirm_all', 'read_only', (frm.doc.confirm_all && isAdvancedWorkflow) ? 1 : 0);
}

function load_terms(frm: FrappeForm<ComplianceStatement>) {
    // Remove auto-save to avoid issues
    if (typeof agt !== 'undefined' && agt.utils.form.field.is_empty(frm.doc.terms_and_conditions)) {
        frappe.db.get_value('Terms and Conditions', 'Term 4.1', 'terms', (r: { terms?: string }) => {
            if (r?.terms) {
                frm.set_value('terms_and_conditions', r.terms);
                agt.utils.dialog.show_debugger_alert(frm, 'Terms loaded.', 'green', 5);
            } else {
                agt.utils.dialog.show_debugger_alert(frm, 'Terms not found.', 'red', 5);
            }
            frm.set_df_property('terms_and_conditions', 'read_only', 1);
            frm.set_df_property('terms_and_conditions', 'hidden', 1);
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
                            agt.utils.document_id(frm, pair.doc, pair.type || undefined, pair.name || undefined);
                        } catch (e) {
                            console.log(`Error processing field ${pair.doc}:`, e);
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
    // All required fields must be filled for each row
    return rows.every((row: any) =>
        requiredFields.every(field => !!row[field])
    );
}