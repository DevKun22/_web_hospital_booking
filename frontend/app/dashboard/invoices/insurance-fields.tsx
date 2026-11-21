"use client";

import { DsField, DsInput, DsSelect, DsTextarea } from "@/components/ds";
import type { InsuranceRouteType } from "@/lib/types";
import { formatMoneyInput, parseMoneyInput } from "@/lib/money-input";
import { insuranceCoverageOptions, insuranceRouteOptions, type InsuranceForm } from "./invoice-model";
// Nhóm ô nhập tính BHYT dùng chung cho lúc tạo hóa đơn và lúc chỉnh giảm.
export function InsuranceFields({
  idPrefix,
  form,
  onChange,
}: {
  idPrefix: string;
  form: InsuranceForm;
  onChange: (next: InsuranceForm) => void;
}) {
  return (
    <>
      <DsField
        label="Số tiền đủ điều kiện BHYT"
        htmlFor={`${idPrefix}-eligible`}
      >
        <DsInput
          id={`${idPrefix}-eligible`}
          inputMode="numeric"
          placeholder="0"
          value={formatMoneyInput(form.eligibleAmount)}
          onChange={(event) =>
            onChange({
              ...form,
              eligibleAmount: parseMoneyInput(event.target.value),
            })
          }
        />
      </DsField>
      <div className="ds-grid-fields">
        <DsField label="Mức hưởng" htmlFor={`${idPrefix}-rate`}>
          <DsSelect
            id={`${idPrefix}-rate`}
            value={form.coverageRate}
            onChange={(event) =>
              onChange({ ...form, coverageRate: event.target.value })
            }
          >
            {insuranceCoverageOptions.map((rate) => (
              <option key={rate} value={rate}>
                {rate}%
              </option>
            ))}
          </DsSelect>
        </DsField>
        <DsField label="Tuyến/loại" htmlFor={`${idPrefix}-route`}>
          <DsSelect
            id={`${idPrefix}-route`}
            value={form.routeType}
            onChange={(event) =>
              onChange({
                ...form,
                routeType: event.target.value as InsuranceRouteType,
              })
            }
          >
            {insuranceRouteOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </DsSelect>
        </DsField>
      </div>
      <DsField label="Ghi chú BHYT" htmlFor={`${idPrefix}-note`}>
        <DsTextarea
          id={`${idPrefix}-note`}
          rows={2}
          value={form.note}
          placeholder="Ví dụ: áp dụng đúng tuyến theo thẻ BHYT"
          onChange={(event) => onChange({ ...form, note: event.target.value })}
        />
      </DsField>
    </>
  );
}
