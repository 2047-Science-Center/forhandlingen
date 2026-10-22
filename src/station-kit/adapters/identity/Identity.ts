/**
 * Identitet in. Kontrakt (§5.2): station<N>/rfid (tagg läst) → tjänsten svarar
 * station<N>/identity {grupp, medlemmar}. Bygger på riggens identificationSystem.
 *
 * I piloten mockas band via MockIdentity (A4).
 */

export interface IdentityMember {
  band_id: string
  name?: string
}

export interface IdentityGroup {
  grupp: string
  medlemmar: IdentityMember[]
}

export interface Identity {
  /** Simulera/utlös en tagg-läsning; resolvar med gruppen tjänsten svarar. */
  tag(bandId: string): Promise<IdentityGroup>
  /**
   * Lyssna på inkommande identiteter som kommer av en HÅRDVARU-bipp (läsaren →
   * regi → station<N>/rfid → identitetstjänst → station<N>/identity). Appen
   * publicerar alltså inget själv — den reagerar bara. Returnerar en
   * avprenumerant. Mock (ingen hårdvara) = no-op.
   */
  listen(cb: (group: IdentityGroup) => void): () => void
}
